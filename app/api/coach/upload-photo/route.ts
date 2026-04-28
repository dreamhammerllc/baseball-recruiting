/**
 * BEFORE THIS ROUTE WILL WORK — create the storage bucket in Supabase:
 *
 *   In the Supabase dashboard → Storage → New bucket:
 *     Name:   coach-photos
 *     Public: true
 *   Or run in the SQL editor:
 *     INSERT INTO storage.buckets (id, name, public)
 *     VALUES ('coach-photos', 'coach-photos', true)
 *     ON CONFLICT (id) DO NOTHING;
 *
 * Also add the photo_url column to the coaches table:
 *   ALTER TABLE coaches ADD COLUMN IF NOT EXISTS photo_url text;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

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
    console.error('[coach/upload-photo] authenticateRequest error:', err);
    return null;
  }
}

const BUCKET = 'coach-photos';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

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

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 5 MB limit.' }, { status: 413 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Please upload a JPEG, PNG, or WebP image.' },
      { status: 415 },
    );
  }

  const ext = file.type === 'image/jpeg' ? 'jpg'
            : file.type === 'image/png'  ? 'png'
            : file.type === 'image/webp' ? 'webp'
            : 'jpg';
  const storagePath = `${userId}/photo.${ext}`;

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient();
  } catch (err) {
    console.error('[coach/upload-photo] admin client init failed:', err);
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[coach/upload-photo] storage upload failed:', uploadError.message);
    return NextResponse.json({ error: 'Photo upload failed. Please try again.' }, { status: 500 });
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
