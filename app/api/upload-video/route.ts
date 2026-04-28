/**
 * Bunny.net video upload proxy.
 * Uploads video to diamond-verified-videos storage zone
 * and returns the CDN URL.
 *
 * File paths:
 *   Metric videos:    /athletes/{athleteId}/{metricKey}/best.mp4
 *   Highlights:       /athletes/{athleteId}/highlights/{slot}.mp4
 *
 * Uses busboy to stream-parse multipart form data, bypassing Next.js's
 * built-in body parser which fails for large binary payloads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Busboy from 'busboy';
import { Readable } from 'stream';
import { METRIC_KEYS, METRIC_INFO, getBunnyVideoPath, getBunnyHighlightPath, getBunnyCoachVerificationPath, type MetricKey } from '@/lib/metrics';
import { createAdminClient } from '@/lib/supabase';

// Allow up to 5 minutes for large video uploads
export const maxDuration = 300;
// Force Node.js runtime — required for stream APIs (Readable.fromWeb, busboy)
export const runtime = 'nodejs';

// ─── Multipart parser ─────────────────────────────────────────────────────────

interface ParsedUpload {
  fileBuffer: Buffer;
  mimeType:   string;
  fields:     Record<string, string>;
}

async function parseMultipart(req: NextRequest): Promise<ParsedUpload> {
  const contentType = req.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data.');
  }

  // Read the full body as an ArrayBuffer — more reliable than piping
  // req.body (a Web ReadableStream) through Readable.fromWeb(), which can
  // silently truncate large binary payloads in Node.js 18-24.
  const rawBody = await req.arrayBuffer();
  if (!rawBody.byteLength) throw new Error('Request body is empty.');

  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: { 'content-type': contentType } });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let mimeType = 'video/mp4';

    bb.on('field', (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on('file', (_fieldName: string, stream: NodeJS.ReadableStream, info: { mimeType: string }) => {
      mimeType = info.mimeType || 'video/mp4';
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    bb.on('close', () => {
      if (!fileBuffer) return reject(new Error('No file field found in form data.'));
      resolve({ fileBuffer, mimeType, fields });
    });

    bb.on('error', reject);

    // Feed busboy from the in-memory buffer via a synthetic Readable.
    // This completely bypasses stream-forwarding issues from the Edge runtime.
    const readable = new Readable({
      read() {
        this.push(Buffer.from(rawBody));
        this.push(null); // signal EOF
      },
    });
    readable.on('error', reject);
    readable.pipe(bb);
  });
}

// ─── Auth helper (no middleware required) ─────────────────────────────────────
// auth() from @clerk/nextjs/server requires clerkMiddleware() to have run.
// This route is excluded from middleware so the request body streams correctly.
// Instead we call authenticateRequest() directly on the raw NextRequest, which
// reads the session token from cookies/Authorization header without any
// middleware context.

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  // publishableKey is required by authenticateRequest to:
  //   1. pass assertValidPublishableKey (throws without it)
  //   2. compute the cookie-name suffix so it finds __session_<hash>
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      // Must be passed here too — authenticateRequest builds a fresh
      // AuthenticateContext from options and needs it for cookie-suffix
      // computation and issuer validation.
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
    // Safety net — catches any exception that escapes handleUpload so the
    // client always receives valid JSON instead of an empty/HTML response.
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

  // ── Parse multipart using busboy ──────────────────────────────────────────
  let parsed: ParsedUpload;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse form data.';
    console.error('[upload-video] Multipart parse error:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { fileBuffer, mimeType, fields } = parsed;
  const uploadType = fields.uploadType;
  const metricKey  = fields.metricKey;
  const slotNumber = fields.slotNumber;

  // ── Validate file ─────────────────────────────────────────────────────────
  if (!fileBuffer.length) {
    return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
  }

  // ── Validate uploadType ───────────────────────────────────────────────────
  if (uploadType !== 'metric' && uploadType !== 'highlight' && uploadType !== 'coach_verification') {
    return NextResponse.json(
      { error: 'uploadType must be "metric", "highlight", or "coach_verification".' },
      { status: 400 },
    );
  }

  // ── Determine storage path ────────────────────────────────────────────────
  let storagePath: string;
  let parsedSlot: number | null = null; // hoisted so Supabase save can use it

  if (uploadType === 'metric') {
    if (!metricKey || !METRIC_KEYS.includes(metricKey as MetricKey)) {
      return NextResponse.json(
        { error: 'metricKey is required and must be a valid metric key when uploadType is "metric".' },
        { status: 400 },
      );
    }
    storagePath = getBunnyVideoPath(userId, metricKey as MetricKey);
  } else if (uploadType === 'highlight') {
    if (!slotNumber) {
      return NextResponse.json(
        { error: 'slotNumber is required when uploadType is "highlight".' },
        { status: 400 },
      );
    }
    parsedSlot = parseInt(slotNumber, 10);
    if (isNaN(parsedSlot) || parsedSlot < 1) {
      return NextResponse.json(
        { error: 'slotNumber must be a positive integer.' },
        { status: 400 },
      );
    }
    storagePath = getBunnyHighlightPath(userId, parsedSlot);
  } else {
    // coach_verification
    const athleteClerkId = fields.athleteClerkId;
    if (!athleteClerkId) {
      return NextResponse.json(
        { error: 'athleteClerkId is required for coach_verification uploads.' },
        { status: 400 },
      );
    }
    if (!metricKey || !METRIC_KEYS.includes(metricKey as MetricKey)) {
      return NextResponse.json(
        { error: 'metricKey must be valid for coach_verification uploads.' },
        { status: 400 },
      );
    }
    storagePath = getBunnyCoachVerificationPath(userId, athleteClerkId, metricKey as MetricKey);
  }

  // ── Read env vars ─────────────────────────────────────────────────────────
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? 'storage.bunnycdn.com';
  const cdnHostname     = process.env.BUNNY_CDN_HOSTNAME;

  if (!storagePassword || !storageZoneName || !cdnHostname) {
    console.error('[upload-video] Missing Bunny.net env vars.');
    return NextResponse.json({ error: 'Video upload service not configured.' }, { status: 500 });
  }

  // ── Upload to Bunny.net storage ───────────────────────────────────────────
  const storageUrl = `https://${storageEndpoint}/${storageZoneName}${storagePath}`;

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(storageUrl, {
      method:  'PUT',
      headers: {
        AccessKey:        storagePassword,
        'Content-Type':   mimeType,
        'Content-Length': String(fileBuffer.byteLength),
      },
      body: new Uint8Array(fileBuffer),
    });
  } catch (err) {
    console.error('[upload-video] Bunny.net PUT request failed:', err);
    return NextResponse.json({ error: 'Video upload failed. Please try again.' }, { status: 500 });
  }

  // Always drain the Bunny response body to free the underlying socket.
  const bunnyText = await uploadResponse.text().catch(() => '');

  if (!uploadResponse.ok) {
    console.error(
      `[upload-video] Bunny.net returned HTTP ${uploadResponse.status}: ${bunnyText}`,
    );
    return NextResponse.json(
      { error: `Video upload failed (storage returned HTTP ${uploadResponse.status}).` },
      { status: 500 },
    );
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────
  const videoUrl = `https://${cdnHostname}${storagePath}`;
  const db = createAdminClient();

  if (uploadType === 'metric' && metricKey) {
    // Try to update the existing personal-best row first.
    // If none exists, insert a placeholder so the video is visible on the
    // dashboard (athlete can fill in the real value via manual entry later).
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
      // No personal-best row yet — insert a placeholder so the video appears.
      const { error } = await db.from('athlete_metrics').insert({
        athlete_clerk_id: userId,
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
    // Upsert so re-uploading to the same slot replaces the old video.
    const { error } = await db
      .from('highlight_videos')
      .upsert(
        { athlete_clerk_id: userId, slot_number: parsedSlot, video_url: videoUrl },
        { onConflict: 'athlete_clerk_id,slot_number' },
      );
    if (error) console.error('[upload-video] Failed to upsert highlight_videos:', error.message);
  }

  // ── Return CDN URL ────────────────────────────────────────────────────────
  console.log('[upload-video] Success:', videoUrl);
  return NextResponse.json({ success: true, videoUrl });
}
