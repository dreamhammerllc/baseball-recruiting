import type { HighlightVideo } from '@/lib/metrics';
import { TIER_FEATURES, type SubscriptionTier } from '@/lib/pricing';

// Public Highlight Reel — renders the Phase 8 highlight_videos slot clips on the
// public profile. Live uploads go through Bunny Stream's TUS pipeline and the
// persisted video_url is ALWAYS an iframe-embed URL of the form
// https://iframe.mediadelivery.net/embed/{lib}/{guid}. We render those embeds
// directly as <iframe> here to guarantee inline playback in the reel —
// VideoPlayer's classifier path produced click-out-to-new-tab behavior for
// these URLs in some browsers. The legacy single "Recruiting Video" surface
// keeps using VideoPlayer; only this reel renders the embed inline.

interface HighlightReelProps {
  highlights: HighlightVideo[];
  ownerTier: SubscriptionTier;
}

const colors = {
  surface: '#111827',
  border:  '#1e2530',
  muted:   '#6b7280',
  bg:      '#0d1117',
};

const sectionStyle: React.CSSProperties = { marginBottom: '2.5rem' };

const headerStyle: React.CSSProperties = {
  fontFamily:    'monospace',
  fontSize:      '0.65rem',
  letterSpacing: '0.18em',
  color:         colors.muted,
  textTransform: 'uppercase',
  margin:        '0 0 1rem',
};

export default function HighlightReel({ highlights, ownerTier }: HighlightReelProps) {
  const slots = TIER_FEATURES[ownerTier].highlightSlots;

  // Free tier: locked teaser. Visual mirrors the PublicMetricsSection fallback
  // in app/profile/[username]/page.tsx — blurred placeholder rows under a dark
  // overlay with a lock glyph and a single-line message.
  if (slots === 0) {
    return (
      <section style={sectionStyle}>
        <h2 style={headerStyle}>Highlight Reel</h2>
        <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '0.6rem',
              filter:        'blur(4px)',
              userSelect:    'none',
              pointerEvents: 'none',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background:   colors.surface,
                  border:       `1px solid ${colors.border}`,
                  borderRadius: '0.75rem',
                  padding:      '0.875rem 1.25rem',
                  height:       '120px',
                }}
              />
            ))}
          </div>
          <div
            style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '0.5rem',
              background:     'rgba(13,17,23,0.7)',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>&#128274;</span>
            <p
              style={{
                fontFamily: 'monospace',
                color:      colors.muted,
                fontSize:   '0.8rem',
                margin:     0,
                textAlign:  'center',
                padding:    '0 1rem',
              }}
            >
              Highlight clips are available on Verified and Elite profiles.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Paid tier with no uploads yet → render nothing on the public page.
  if (highlights.length === 0) return null;

  const ordered = [...highlights].sort((a, b) => a.slot_number - b.slot_number);

  return (
    <section style={sectionStyle}>
      <h2 style={headerStyle}>Highlight Reel</h2>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap:                 '1rem',
        }}
      >
        {ordered.map((h) => (
          <div
            key={h.id}
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '0.6rem',
            }}
          >
            {/* 16:9 wrapper — iframe fills it absolutely so the embed
                renders inline at the correct aspect ratio. No border. */}
            <div
              style={{
                position:     'relative',
                aspectRatio:  '16 / 9',
                background:   '#000',
                borderRadius: '0.75rem',
                overflow:     'hidden',
              }}
            >
              <iframe
                src={`${h.video_url}?autoplay=false&preload=true`}
                loading="lazy"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{
                  position: 'absolute',
                  top:      0,
                  left:     0,
                  width:    '100%',
                  height:   '100%',
                  border:   'none',
                }}
              />
            </div>
            <p
              style={{
                fontFamily:    'monospace',
                fontSize:      '0.7rem',
                letterSpacing: '0.1em',
                color:         colors.muted,
                textTransform: 'uppercase',
                margin:        0,
              }}
            >
              Highlight {h.slot_number}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
