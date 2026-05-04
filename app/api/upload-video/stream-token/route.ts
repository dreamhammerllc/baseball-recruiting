import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filename, metricKey, slotNumber, uploadType } = await req.json();

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey    = process.env.BUNNY_STREAM_API_KEY;
  const cdnHost   = process.env.BUNNY_STREAM_CDN_HOSTNAME;

  if (!libraryId || !apiKey || !cdnHost) {
    console.error('[stream-token] Missing Bunny Stream env vars');
    return NextResponse.json({ error: 'Video service not configured.' }, { status: 500 });
  }

  // Build a descriptive title for the video entry in Bunny Stream
  const suffix = uploadType === 'highlight' ? `highlight-${slotNumber ?? 0}` : (metricKey ?? 'video');
  const title   = `${uploadType}-${suffix}-${userId}-${Date.now()}`;

  // Create a video entry in Bunny Stream to obtain a videoId
  const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method:  'POST',
    headers: {
      AccessKey:      apiKey,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    console.error(`[stream-token] Bunny create video failed ${createRes.status}: ${text}`);
    return NextResponse.json({ error: 'Failed to create video entry.' }, { status: 500 });
  }

  const video   = await createRes.json() as { guid: string };
  const videoId = video.guid;

  if (!videoId) {
    return NextResponse.json({ error: 'Bunny returned no videoId.' }, { status: 500 });
  }

  // Generate TUS auth signature: SHA256(libraryId + apiKey + expirationTime + videoId)
  const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const signature = crypto
    .createHash('sha256')
    .update(`${libraryId}${apiKey}${expirationTime}${videoId}`)
    .digest('hex');

  // Bunny Stream embed URL — use iframe player to avoid direct MP4 access restrictions
  const cdnUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

  return NextResponse.json({
    videoId,
    libraryId,
    expirationTime,
    signature,
    cdnUrl,
  });
}
