/**
 * POST /api/coach/upload-readout
 *
 * Uploads a device-readout artifact (PDF or image — HitTrax / Rapsodo / Blast /
 * Trackman screenshot or report) for a coach verification attempt. Stored in
 * the existing `documents` Supabase Storage bucket under a coach-keyed prefix.
 * Returns the public URL; the client passes it along in the verify-metric
 * request body (verify-metric will consume `readoutUrl` in a later change).
 *
 * Mirrors /api/upload-pitch-proof — same bucket, same auth pattern, same
 * MIME allowlist. No new Supabase resources required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';
import { extractReadoutValue } from '@/lib/visionExtract';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

function getAdminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !serviceKey) throw new Error('Supabase env vars not configured.');
  return createClient(url, serviceKey);
}

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    if (!state.isSignedIn) return null;
    return state.toAuth().userId;
  } catch (err) {
    console.error('[upload-readout] authenticateRequest error:', err);
    return null;
  }
}

const BUCKET = 'documents';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches documents bucket cap
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── Parse FormData ──────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  // ── Validate file ───────────────────────────────────────────────────────────
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 10 MB limit.' }, { status: 413 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Please upload a PDF or image.' },
      { status: 415 },
    );
  }

  // ── Build storage path ──────────────────────────────────────────────────────
  // Timestamp prefix prevents collisions when a coach uploads multiple readouts
  // for the same athlete with the same source filename (e.g. "rapsodo.pdf").
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `${userId}/readouts/${Date.now()}-${safeName}`;

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient();
  } catch (err) {
    console.error('[upload-readout] admin client init failed:', err);
    return apiError('Server configuration error.', err);
  }

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[upload-readout] storage upload failed:', uploadError.message);
    return apiError('File upload failed. Please try again.', uploadError);
  }

  // ── Derive the public URL ───────────────────────────────────────────────────
  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // ── Best-effort: extract a metric value from the readout and log it ─────────
  //
  // When the client tells us which metric the coach is verifying, run Claude
  // Vision once on the server and record the result in `readout_extractions`.
  // The verify-metric decision (next phase) will read this row back by id, so
  // the server only ever trusts its own computed value — never one supplied by
  // the client. A row is written even when the value is null (HEIC / unread-
  // able) so the attempt is auditable; the form handles the null state.
  //
  // Wrapped in try/catch and a metricKey-presence guard so an extraction or
  // ledger failure can NEVER break the upload. On any failure the response
  // still includes a valid `url` so the form can fall back to a no-extraction
  // upload flow.
  const metricKeyRaw       = formData.get('metricKey');
  const athleteClerkIdRaw  = formData.get('athleteClerkId');
  const metricKey =
    typeof metricKeyRaw === 'string' && metricKeyRaw.length > 0
      ? metricKeyRaw
      : null;
  const athleteClerkId =
    typeof athleteClerkIdRaw === 'string' && athleteClerkIdRaw.length > 0
      ? athleteClerkIdRaw
      : null;

  let extractionId: string | null = null;
  let extracted: { value: number | null; confidence: number; notes: string | null } | null = null;

  // `METRIC_INFO[k]` returns undefined for keys not in the union — safe guard
  // against arbitrary strings posted from the client.
  const info = metricKey ? METRIC_INFO[metricKey as MetricKey] : undefined;
  if (info) {
    try {
      const fileBase64 = Buffer.from(fileBuffer).toString('base64');
      const result = await extractReadoutValue({
        metricKey,
        metricLabel: info.label,
        unit:        info.unit,
        fileBase64,
        mimeType:    file.type,
      });

      const { data: ledgerRow, error: ledgerError } = await db
        .from('readout_extractions')
        .insert({
          coach_clerk_id:   userId,
          athlete_clerk_id: athleteClerkId,
          metric_key:       metricKey,
          extracted_value:  result.value,
          confidence:       result.confidence,
          notes:            result.notes,
          mime_type:        file.type,
          storage_path:     storagePath,
          readout_url:      publicUrl,
        })
        .select('id')
        .single();

      if (ledgerError) {
        throw new Error(`ledger insert failed: ${ledgerError.message}`);
      }

      extractionId = ledgerRow?.id ?? null;
      extracted = {
        value:      result.value,
        confidence: result.confidence,
        notes:      result.notes,
      };
    } catch (err) {
      console.error('[upload-readout] extraction/ledger skipped:', err);
      extractionId = null;
      extracted = null;
    }
  }

  return NextResponse.json({ success: true, url: publicUrl, extractionId, extracted });
}
