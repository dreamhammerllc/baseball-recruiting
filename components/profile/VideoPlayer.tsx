import { getVideoPlaybackInfo } from '@/lib/videoPlayback';

interface YouTubeMatch {
  id: string;
}

function parseYouTubeUrl(url: string): YouTubeMatch | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? { id } : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return { id: v };
      const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/);
      if (m) return { id: m[1] };
    }
  } catch {
    // not a parseable URL
  }
  return null;
}

export default function VideoPlayer({
  url,
  title = 'Recruiting Video',
  showPlaceholder = false,
}: {
  url:              string | null;
  title?:           string;
  /** When true, render a "no video uploaded yet" card if url is missing/unparseable. */
  showPlaceholder?: boolean;
}) {
  const playback = url ? getVideoPlaybackInfo(url) : { kind: 'unsupported' as const };
  const youtube = url && playback.kind === 'unsupported' ? parseYouTubeUrl(url) : null;

  if (playback.kind === 'unsupported' && !youtube) {
    if (!showPlaceholder) return null;
    return (
      <section style={{ marginBottom: '2.5rem' }}>
        <Header title={title} />
        <div
          style={{
            background:    '#111827',
            border:        '1px dashed #1e2530',
            borderRadius:  '0.75rem',
            padding:       '1.5rem 1.25rem',
            textAlign:     'center',
          }}
        >
          <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
            No recruiting video uploaded yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <Header title={title} />
      <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '0.75rem', overflow: 'hidden' }}>
        {playback.kind === 'mp4' && (
          <video
            src={playback.src}
            controls
            style={{ position: 'absolute', top: 0, height: '100%', width: '100%', background: '#000' }}
          />
        )}
        {playback.kind === 'iframe' && (
          <iframe
            src={playback.src}
            loading="lazy"
            style={{ border: 'none', position: 'absolute', top: 0, height: '100%', width: '100%' }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
        )}
        {youtube && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtube.id}?rel=0`}
            loading="lazy"
            style={{ border: 'none', position: 'absolute', top: 0, height: '100%', width: '100%' }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
        )}
      </div>
    </section>
  );
}

function Header({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontFamily:    'monospace',
        fontSize:      '0.65rem',
        letterSpacing: '0.18em',
        color:         '#6b7280',
        textTransform: 'uppercase',
        margin:        '0 0 1rem',
      }}
    >
      {title}
    </h2>
  );
}
