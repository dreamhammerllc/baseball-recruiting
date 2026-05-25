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

  return NextResponse.json({ success: true, url: publicUrl });
}
