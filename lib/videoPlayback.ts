/**
 * Video playback URL detection — chooses how to render a stored video_url.
 *
 * Verification video URLs come in three forms across the codebase:
 *   - Bunny pull-zone direct MP4:  https://vz-{libcode}.b-cdn.net/{guid}/play_{n}p.mp4
 *   - Vercel Blob direct MP4:      https://{prefix}.public.blob.vercel-storage.com/...
 *   - Bunny Stream iframe embed:   https://iframe.mediadelivery.net/embed/{lib}/{guid}
 *
 * Direct MP4 URLs are played in a native <video> element — no library
 * coordination required. Iframe-embed URLs need to be rebuilt with the
 * current library ID (NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID) because the
 * library at upload time may not match playback time.
 */

export type PlaybackInfo =
  | { kind: 'mp4'; src: string }
  | { kind: 'iframe'; src: string }
  | { kind: 'unsupported' };

const VERCEL_BLOB_HOST = 'public.blob.vercel-storage.com';
const BUNNY_PULLZONE_MP4 = /^https:\/\/vz-[^/]+\.b-cdn\.net\/[^/]+\/play_\d+p\.mp4/i;
const BUNNY_IFRAME_EMBED = /iframe\.mediadelivery\.net\/embed\/\d+\/([\w-]+)/;

export function getVideoPlaybackInfo(url: string | null | undefined): PlaybackInfo {
  if (!url) return { kind: 'unsupported' };

  if (url.includes(VERCEL_BLOB_HOST)) {
    return { kind: 'mp4', src: url };
  }

  if (BUNNY_PULLZONE_MP4.test(url)) {
    return { kind: 'mp4', src: url };
  }

  const embedMatch = url.match(BUNNY_IFRAME_EMBED);
  if (embedMatch) {
    const libraryId = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID ?? '';
    if (!libraryId) return { kind: 'unsupported' };
    return {
      kind: 'iframe',
      src: `https://iframe.mediadelivery.net/embed/${libraryId}/${embedMatch[1]}?autoplay=false&preload=true`,
    };
  }

  return { kind: 'unsupported' };
}
