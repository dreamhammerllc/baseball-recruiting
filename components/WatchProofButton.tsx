'use client';

/**
 * WatchProofButton — small client wrapper used by VerifiedAttribution.
 *
 * Renders a compact gold button labelled "▶ Watch proof". Clicking it opens
 * the shared WatchVideoModal as an in-page overlay (Bunny iframe or mp4 via
 * lib/videoPlayback). Stays as a client island so the surrounding
 * VerifiedAttribution can remain a server component.
 *
 * The modal is portalled to document.body so its `position: fixed` overlay
 * isn't constrained by any transformed / contained ancestor (the StatCard
 * grid + PitchArsenal grid both create stacking contexts that broke the
 * full-viewport dim in the first ship of 2c-iv). SSR-safe via a hydration
 * guard: createPortal is only called after the component has mounted.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import WatchVideoModal from './WatchVideoModal';

interface WatchProofButtonProps {
  videoUrl: string;
  title:    string;
}

export default function WatchProofButton({ videoUrl, title }: WatchProofButtonProps) {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);

  // Defer portal creation until after hydration so document.body is defined
  // and so server-rendered HTML matches the initial client render exactly.
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background:    'rgba(232,160,32,0.08)',
          border:        '1px solid rgba(232,160,32,0.3)',
          borderRadius:  '0.375rem',
          color:         '#e8a020',
          fontSize:      '0.7rem',
          fontWeight:    600,
          fontFamily:    'monospace',
          padding:       '0.25rem 0.65rem',
          cursor:        'pointer',
          alignSelf:     'flex-start',
          letterSpacing: '0.03em',
          transition:    'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(232,160,32,0.15)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8a020';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(232,160,32,0.08)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.3)';
        }}
      >
        ▶ Watch proof
      </button>

      {open && mounted && createPortal(
        <WatchVideoModal
          title={title}
          videoUrl={videoUrl}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
