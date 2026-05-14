'use client';

import { getVideoPlaybackInfo } from '@/lib/videoPlayback';

export interface WatchVideoModalProps {
  title: string;
  videoUrl: string | null;
  onClose: () => void;
  onReUpload?: () => void;
}

export default function WatchVideoModal({
  title,
  videoUrl,
  onClose,
  onReUpload,
}: WatchVideoModalProps) {
  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(13,17,23,0.90)',
        zIndex:          100,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        '100%',
          maxWidth:     '720px',
          background:   '#111827',
          border:       '1px solid #1e2530',
          borderRadius: '0.75rem',
        }}
      >
        {/* Modal header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '1rem 1.25rem',
          borderBottom:   '1px solid #1e2530',
        }}>
          <span style={{
            color:      '#f0f6fc',
            fontWeight: 700,
            fontSize:   '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background:   'transparent',
              border:       'none',
              color:        '#6b7280',
              fontSize:     '1.25rem',
              lineHeight:   1,
              cursor:       'pointer',
              padding:      '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              transition:   'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
            aria-label="Close video player"
          >
            &#x2715;
          </button>
        </div>

        {/* Video player */}
        <div style={{ backgroundColor: '#000' }}>
          {videoUrl ? (() => {
            const playback = getVideoPlaybackInfo(videoUrl);
            if (playback.kind === 'mp4') {
              return (
                <video
                  src={playback.src}
                  controls
                  autoPlay
                  style={{ display: 'block', width: '100%', height: '300px', background: '#000', border: 'none' }}
                />
              );
            }
            if (playback.kind === 'iframe') {
              return (
                <iframe
                  src={playback.src}
                  width="100%"
                  height="300"
                  loading="lazy"
                  style={{ border: 'none', display: 'block' }}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              );
            }
            // Unsupported format
            return (
              <div style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: '#0d1117' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
                  Video format not supported &mdash; please re-upload this video.
                </p>
                {onReUpload && (
                  <button
                    onClick={onReUpload}
                    style={{
                      backgroundColor: '#e8a020',
                      color:           '#000',
                      border:          'none',
                      borderRadius:    '0.5rem',
                      padding:         '0.5rem 1.25rem',
                      fontSize:        '0.875rem',
                      fontWeight:      700,
                      cursor:          'pointer',
                    }}
                  >
                    Upload Video
                  </button>
                )}
              </div>
            );
          })() : (
            <div style={{
              padding:    '3rem',
              textAlign:  'center',
              color:      '#4b5563',
              fontSize:   '0.875rem',
              lineHeight: 1.5,
            }}>
              No video available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
