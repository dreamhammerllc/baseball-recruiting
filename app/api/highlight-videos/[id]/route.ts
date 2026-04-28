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
    console.error('[highlight-videos] authenticateRequest error:', err);
    return null;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing video id.' }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch the row first to confirm ownership
  const { data: row, error: fetchError } = await db
    .from('highlight_videos')
    .select('id, athlete_clerk_id, video_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('[highlight-videos/delete] fetch error:', fetchError.message);
    return NextResponse.json({ error: 'Database error.' }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if ((row as { athlete_clerk_id: string }).athlete_clerk_id !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Delete from Supabase
  const { error: deleteError } = await db
    .from('highlight_videos')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[highlight-videos/delete] delete error:', deleteError.message);
    return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  }

  // Best-effort: delete from Bunny.net CDN storage
  // The video_url is like https://diamond-verified-cdn.b-cdn.net/athletes/xxx/highlights/N.mp4
  // We derive the storage path from the URL
  const videoUrl = (row as { video_url: string }).video_url ?? '';
  const cdnHost  = process.env.BUNNY_CDN_HOSTNAME ?? 'diamond-verified-cdn.b-cdn.net';
  const storagePath = videoUrl.replace(`https://${cdnHost}`, '');

  if (storagePath && storagePath !== videoUrl) {
    const zone = process.env.BUNNY_STORAGE_ZONE_NAME ?? 'diamond-verified-videos';
    const pw   = process.env.BUNNY_STORAGE_PASSWORD ?? '';
    try {
      await fetch(`https://storage.bunnycdn.com/${zone}${storagePath}`, {
        method:  'DELETE',
        headers: { AccessKey: pw },
      });
    } catch (err) {
      // Non-fatal — row is already deleted from DB
      console.error('[highlight-videos/delete] Bunny delete error:', err);
    }
  }

  return NextResponse.json({ success: true });
}
