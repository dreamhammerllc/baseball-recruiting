/**
 * BEFORE THIS ROUTE WILL WORK — two manual setup steps in Supabase:
 *
 * 1. CREATE THE STORAGE BUCKET
 *    In the Supabase dashboard → Storage → New bucket:
 *      Name:   documents
 *      Public: true   (so we can derive a stable public URL without signed links)
 *    Or run in the SQL editor:
 *      INSERT INTO storage.buckets (id, name, public)
 *      VALUES ('documents', 'documents', true)
 *      ON CONFLICT (id) DO NOTHING;
 *
 * 2. ADD COLUMNS TO THE ATHLETES TABLE
 *    Run in the Supabase SQL editor:
 *      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS transcript_url  text;
 *      ALTER TABLE athletes ADD COLUMN IF NOT EXISTS test_scores_url text;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

// Always use the service-role key here — this route runs on the server only
// and needs to bypass Row Level Security for the athletes upsert.
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
    console.error('[upload-document] authenticateRequest error:', err);
    return null;
  }
}

const BUCKET = 'documents';
const ALLOWED_TYPES = new Set(['transcript', 'test_scores']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
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
  const documentType = formData.get('documentType');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  if (typeof documentType !== 'string' || !ALLOWED_TYPES.has(documentType)) {
    return NextResponse.json(
      { error: 'Invalid documentType. Must be "transcript" or "test_scores".' },
      { status: 400 },
    );
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
  // Sanitise the original filename so it's safe for object storage paths.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `${userId}/${documentType}/${safeName}`;

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  let db: ReturnType<typeof createClient>;
  try {
    db = getAdminClient();
  } catch (err) {
    console.error('[upload-document] admin client init failed:', err);
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true, // overwrite if the athlete re-uploads the same filename
    });

  if (uploadError) {
    console.error('[upload-document] storage upload failed:', uploadError.message);
    return NextResponse.json(
      { error: 'File upload failed. Please try again.' },
      { status: 500 },
    );
  }

  // ── Derive the public URL ───────────────────────────────────────────────────
  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // ── Update the athletes table ────────────────────────────────────────────────
  const column = documentType === 'transcript' ? 'transcript_url' : 'test_scores_url';

  const { error: dbError } = await db
    .from('athletes')
    .update({ [column]: publicUrl })
    .eq('clerk_user_id', userId);

  if (dbError) {
    // The file is already safely uploaded; log the DB error but don't fail the
    // request entirely — the client still gets the URL and can display the file.
    console.error('[upload-document] athletes update failed:', dbError.message);
  }

  return NextResponse.json({ success: true, url: publicUrl });
}
