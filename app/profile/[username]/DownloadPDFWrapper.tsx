'use client';

import dynamic from 'next/dynamic';
import type { DownloadPDFButtonProps } from './DownloadPDFButton';

// @react-pdf/renderer uses browser-only APIs (canvas, Blob, etc.) that crash
// during SSR. This wrapper is a client component, so next/dynamic with
// ssr: false is allowed here — the import never runs on the server.
const DownloadPDFButton = dynamic(() => import('./DownloadPDFButton'), {
  ssr: false,
  loading: () => (
    <button
      disabled
      style={{
        width: '100%',
        padding: '0.85rem',
        backgroundColor: 'transparent',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        color: '#4b5563',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download PDF
    </button>
  ),
});

export default function DownloadPDFWrapper(props: DownloadPDFButtonProps) {
  return <DownloadPDFButton {...props} />;
}
