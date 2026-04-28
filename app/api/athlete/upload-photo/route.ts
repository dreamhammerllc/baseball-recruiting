/**
 * POST /api/athlete/upload-photo
 *
 * Requires in Supabase before use:
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('athlete-photos', 'athlete-photos', true)
 *   ON CONFLICT (id) DO NOTHING;
 *
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS photo_url text;
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

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
    console.error('[athlete/upload-photo] auth error:', err);
    return null;
  }
}

const BUCKET = 'athlete-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 5 MB limit.' }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 415 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${userId}/photo.${ext}`;

  const db = createAdminClient();
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error('[athlete/upload-photo] upload error:', uploadError.message);
    return NextResponse.json({ error: 'Photo upload failed. Please try again.' }, { status: 500 });
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);

  await db
    .from('athletes')
    .update({ photo_url: urlData.publicUrl })
    .eq('clerk_user_id', userId);

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
