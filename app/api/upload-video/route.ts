/**
 * Bunny.net video upload — streaming proxy.
 *
 * The multipart body is piped through busboy WITHOUT buffering the file.
 * Text fields (uploadType, metricKey, …) are collected first, then the
 * file stream is forwarded directly to Bunny via fetch(), bypassing
 * Vercel's 4.5 MB body-size limit entirely.
 *
 * IMPORTANT: callers must append all text fields BEFORE the file field
 * in their FormData so busboy sees them before the file stream starts.
 *
 * Storage paths:
 *   Metric videos:       /athletes/{userId}/{metricKey}/best.mp4
 *   Highlight videos:    /athletes/{userId}/highlights/{slot}.mp4
 *   Coach verifications: /coaches/{coachId}/{athleteId}/{metricKey}.mp4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Busboy from 'busboy';
import { Readable } from 'stream';
import {
  METRIC_KEYS,
  METRIC_INFO,
  getBunnyVideoPath,
  getBunnyHighlightPath,
  getBunnyCoachVerificationPath,
  type MetricKey,
} from '@/lib/metrics';
import { createAdminClient } from '@/lib/supabase';

export const maxDuration = 300;
export const runtime = 'nodejs';

// ─── Auth ─────────────────────────────────────────────────────────────────────

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    if (!state.isSignedIn) return null;
    return state.toAuth().userId;
  } catch (err) {
    console.error('[upload-video] authenticateRequest error:', err);
    return null;
  }
}

// ─── POST /api/upload-video ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    return await handleUpload(req);
  } catch (err) {
    console.error('[upload-video] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred.' },
      { status: 500 },
    );
  }
}

async function handleUpload(req: NextRequest): Promise<NextResponse> {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Content-Type must be multipart/form-data.' },
      { status: 400 },
    );
  }

  if (!req.body) {
    return NextResponse.json({ error: 'Request body is empty.' }, { status: 400 });
  }

  // Read Bunny env vars up front so we can fail fast before touching the stream.
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? 'storage.bunnycdn.com';
  const cdnHostname     = process.env.BUNNY_CDN_HOSTNAME;

  if (!storagePassword || !storageZoneName || !cdnHostname) {
    console.error('[upload-video] Missing Bunny.net env vars.');
    return NextResponse.json({ error: 'Video upload service not configured.' }, { status: 500 });
  }

  // ── Stream multipart body through busboy ──────────────────────────────────
  //
  // We wrap everything in a Promise so we can resolve/reject from inside the
  // busboy event callbacks (which are sync-ish, but the file upload is async).
  //
  // Caller contract: all text fields must appear BEFORE the file field in the
  // FormData so that when the 'file' event fires, `fields` is already complete.

  return new Promise<NextResponse>((resolve) => {
    const bb = Busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, string> = {};
    let settled = false;

    function settle(response: NextResponse) {
      if (!settled) {
        settled = true;
        resolve(response);
      }
    }

    bb.on('field', (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on('file', async (_fieldName: string, fileStream: NodeJS.ReadableStream, info: { mimeType: string }) => {
      const mimeType     = info.mimeType || 'video/mp4';
      const uploadType   = fields.uploadType;
      const metricKey    = fields.metricKey;
      const slotNumber   = fields.slotNumber;
      const athleteClerkId = fields.athleteClerkId;

      // ── Validate ──────────────────────────────────────────────────────────
      if (uploadType !== 'metric' && uploadType !== 'highlight' && uploadType !== 'coach_verification') {
        fileStream.resume();
        settle(NextResponse.json({ error: 'uploadType must be "metric", "highlight", or "coach_verification".' }, { status: 400 }));
        return;
      }

      let storagePath: string;
      let parsedSlot: number | null = null;

      if (uploadType === 'metric') {
        if (!metricKey || !METRIC_KEYS.includes(metricKey as MetricKey)) {
          fileStream.resume();
          settle(NextResponse.json({ error: 'metricKey is required and must be valid when uploadType is "metric".' }, { status: 400 }));
          return;
        }
        storagePath = getBunnyVideoPath(userId, metricKey as MetricKey);

      } else if (uploadType === 'highlight') {
        if (!slotNumber) {
          fileStream.resume();
          settle(NextResponse.json({ error: 'slotNumber is required when uploadType is "highlight".' }, { status: 400 }));
          return;
        }
        parsedSlot = parseInt(slotNumber, 10);
        if (isNaN(parsedSlot) || parsedSlot < 1) {
          fileStream.resume();
          settle(NextResponse.json({ error: 'slotNumber must be a positive integer.' }, { status: 400 }));
          return;
        }
        storagePath = getBunnyHighlightPath(userId, parsedSlot);

      } else {
        // coach_verification
        if (!athleteClerkId) {
          fileStream.resume();
          settle(NextResponse.json({ error: 'athleteClerkId is required for coach_verification uploads.' }, { status: 400 }));
          return;
        }
        if (!metricKey || !METRIC_KEYS.includes(metricKey as MetricKey)) {
          fileStream.resume();
          settle(NextResponse.json({ error: 'metricKey must be valid for coach_verification uploads.' }, { status: 400 }));
          return;
        }
        storagePath = getBunnyCoachVerificationPath(userId, athleteClerkId, metricKey as MetricKey);
      }

      // ── Stream file directly to Bunny ─────────────────────────────────────
      const storageUrl = `https://${storageEndpoint}/${storageZoneName}${storagePath}`;

      // Convert Node.js Readable (from busboy) to a Web ReadableStream so
      // Node's built-in fetch can consume it as a streaming request body.
      const webStream = Readable.toWeb(fileStream as Readable) as ReadableStream<Uint8Array>;

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(storageUrl, {
          method:  'PUT',
          headers: {
            AccessKey:      storagePassword,
            'Content-Type': mimeType,
          },
          // Pass the stream directly — never materialized in memory.
          // `duplex: 'half'` is required by Node.js fetch for streaming bodies.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body:   webStream as any,
          // @ts-expect-error -- duplex is a valid Node.js fetch option not yet in the TS types
          duplex: 'half',
        });
      } catch (err) {
        console.error('[upload-video] Bunny PUT request failed:', err);
        settle(NextResponse.json({ error: 'Video upload failed. Please try again.' }, { status: 500 }));
        return;
      }

      // Drain the Bunny response body to free the socket.
      const bunnyText = await uploadResponse.text().catch(() => '');

      if (!uploadResponse.ok) {
        console.error(`[upload-video] Bunny returned HTTP ${uploadResponse.status}: ${bunnyText}`);
        settle(NextResponse.json(
          { error: `Video upload failed (storage returned HTTP ${uploadResponse.status}).` },
          { status: 500 },
        ));
        return;
      }

      // ── Persist to Supabase ───────────────────────────────────────────────
      const videoUrl = `https://${cdnHostname}${storagePath}`;
      const db = createAdminClient();

      if (uploadType === 'metric' && metricKey) {
        const { data: existingPB } = await db
          .from('athlete_metrics')
          .select('id')
          .eq('athlete_clerk_id', userId)
          .eq('metric_key', metricKey)
          .eq('is_personal_best', true)
          .maybeSingle();

        if (existingPB) {
          const { error } = await db
            .from('athlete_metrics')
            .update({ video_url: videoUrl })
            .eq('id', existingPB.id);
          if (error) console.error('[upload-video] Failed to update video_url:', error.message);
        } else {
          const { error } = await db.from('athlete_metrics').insert({
            athlete_clerk_id:  userId,
            metric_key:        metricKey,
            value:             0,
            unit:              METRIC_INFO[metricKey as MetricKey].unit,
            verification_type: 'self_reported',
            is_personal_best:  true,
            video_url:         videoUrl,
          });
          if (error) console.error('[upload-video] Failed to insert placeholder metric:', error.message);
        }
      }

      if (uploadType === 'highlight' && parsedSlot !== null) {
        const { error } = await db
          .from('highlight_videos')
          .upsert(
            { athlete_clerk_id: userId, slot_number: parsedSlot, video_url: videoUrl },
            { onConflict: 'athlete_clerk_id,slot_number' },
          );
        if (error) console.error('[upload-video] Failed to upsert highlight_videos:', error.message);
      }

      console.log('[upload-video] Success:', videoUrl);
      settle(NextResponse.json({ success: true, videoUrl }));
    });

    bb.on('error', (err: Error) => {
      console.error('[upload-video] Busboy error:', err);
      settle(NextResponse.json({ error: err.message }, { status: 400 }));
    });

    bb.on('close', () => {
      // If the form had no file field at all, settle with an error.
      if (!settled) {
        settle(NextResponse.json({ error: 'No file field found in form data.' }, { status: 400 }));
      }
    });

    // Pipe the Web ReadableStream (req.body) into busboy via a Node.js Readable.
    // This never buffers the full payload — chunks flow through as they arrive.
    const nodeReadable = Readable.fromWeb(req.body as ReadableStream<Uint8Array>);
    nodeReadable.on('error', (err: Error) => {
      console.error('[upload-video] Request stream error:', err);
      settle(NextResponse.json({ error: 'Failed to read request stream.' }, { status: 500 }));
    });
    nodeReadable.pipe(bb);
  });
}
