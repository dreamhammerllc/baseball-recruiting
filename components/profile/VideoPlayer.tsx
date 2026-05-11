type Provider = 'bunny' | 'youtube';

interface Parsed {
  provider: Provider;
  id:       string;
}

function parseVideoUrl(url: string): Parsed | null {
  if (!url) return null;

  // Bunny Stream — iframe form: https://iframe.mediadelivery.net/embed/653202/<id>
  if (url.includes('iframe.mediadelivery.net')) {
    const id = url.split('/').pop()?.split('?')[0] ?? '';
    return id ? { provider: 'bunny', id } : null;
  }

  // Bunny Stream — CDN form: https://vz-d9ee7f6e-2b7.b-cdn.net/<id>/...
  if (url.includes('vz-d9ee7f6e-2b7.b-cdn.net')) {
    const id = url.split('/')[3] ?? '';
    return id ? { provider: 'bunny', id } : null;
  }

  // YouTube — youtu.be/<id>, youtube.com/watch?v=<id>,
  // youtube.com/embed/<id>, youtube.com/shorts/<id>, m.youtube.com/*
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? { provider: 'youtube', id } : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return { provider: 'youtube', id: v };
      const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/);
      if (m) return { provider: 'youtube', id: m[1] };
    }
  } catch {
    // not a parseable URL
  }

  return null;
}

function embedSrc(parsed: Parsed): string {
  if (parsed.provider === 'bunny') {
    const lib = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID ?? '';
    return `https://iframe.mediadelivery.net/embed/${lib}/${parsed.id}?autoplay=false&preload=true`;
  }
  return `https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0`;
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
  const parsed = url ? parseVideoUrl(url) : null;

  if (!parsed) {
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
        <iframe
          src={embedSrc(parsed)}
          loading="lazy"
          style={{ border: 'none', position: 'absolute', top: 0, height: '100%', width: '100%' }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
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
