'use client';

import { useState, useEffect } from 'react';
import type { MetricKey } from '@/lib/metrics';
import { METRIC_INFO } from '@/lib/metrics';
import type { VerificationDetails } from '@/app/api/coach/verification-details/route';

interface CoachVerificationModalProps {
  metricKey: MetricKey;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function CoachAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  return (
    <div style={{
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      backgroundColor: 'rgba(232,160,32,0.12)',
      border: '1px solid rgba(232,160,32,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      )}
    </div>
  );
}

export default function CoachVerificationModal({ metricKey, onClose }: CoachVerificationModalProps) {
  const [details, setDetails] = useState<VerificationDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/coach/verification-details?metricKey=${encodeURIComponent(metricKey)}`)
      .then(r => r.json())
      .then(data => {
        setDetails(Array.isArray(data.details) ? data.details : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load verification details.');
        setLoading(false);
      });
  }, [metricKey]);

  const metricLabel = METRIC_INFO[metricKey].label;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(13,17,23,0.90)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#111827',
          border: '1px solid #1e2530',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #1e2530',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem' }}>
              Coach Verified
            </p>
            <span style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem', fontFamily: 'Georgia, serif' }}>
              {metricLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '1.25rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
              Loading...
            </p>
          )}

          {!loading && error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{error}</p>
          )}

          {!loading && !error && details.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              No coach verifications found for this metric.
            </p>
          )}

          {!loading && !error && details.length > 0 && (
            <>
              {/* Gold verified badge — shown once at top */}
              <div style={{
                backgroundColor: 'rgba(232,160,32,0.08)',
                border: '1px solid rgba(232,160,32,0.2)',
                borderRadius: '0.5rem',
                padding: '0.65rem 0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexShrink: 0,
              }}>
                <span style={{ color: '#e8a020', fontSize: '0.78rem', fontWeight: 600 }}>
                  &#10003; Verified by a credentialed coach on Diamond Verified
                </span>
              </div>

              {/* Coach cards */}
              {details.map((d, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #1e2530',
                    borderRadius: '0.625rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    backgroundColor: '#0d1117',
                  }}
                >
                  {/* Coach identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CoachAvatar photoUrl={d.photoUrl} name={d.fullName} />
                    <div>
                      <p style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                        {d.fullName}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.1rem 0 0' }}>
                        {d.title}
                      </p>
                    </div>
                  </div>

                  {/* Detail rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #1e2530' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>Organization</span>
                      <span style={{ color: '#f0f6fc', fontSize: '0.85rem', fontWeight: 600 }}>{d.organization}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>Date Verified</span>
                      <span style={{ color: '#f0f6fc', fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(d.approvedAt)}</span>
                    </div>
                  </div>

                  {/* Email link */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      Contact
                    </span>
                    <a
                      href={`mailto:${d.email}`}
                      style={{
                        color: '#58a6ff',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        wordBreak: 'break-all',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                    >
                      {d.email}
                    </a>
                  </div>

                  {/* Watch video button */}
                  {d.videoUrl && (
                    <a
                      href={d.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: 'rgba(232,160,32,0.08)',
                        border: '1px solid rgba(232,160,32,0.3)',
                        borderRadius: '0.4rem',
                        color: '#e8a020',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        padding: '0.4rem 0.85rem',
                        textDecoration: 'none',
                        alignSelf: 'flex-start',
                      }}
                    >
                      ▶ Watch Verification Video
                    </a>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
