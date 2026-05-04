'use client';

import { useState, useEffect } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';
import type { Evaluation } from '@/app/api/coach/evaluations/route';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function toEmbedUrl(url: string): string {
  if (url.includes('iframe.mediadelivery.net')) return url;
  const videoId = url.split('/').slice(-2)[0];
  return `https://iframe.mediadelivery.net/embed/653202/${videoId}`;
}

function StatusBadge({ status }: { status: string }) {
  const approved = status === 'approved';
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.6rem',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: 700,
      backgroundColor: approved ? 'rgba(74,222,128,0.1)' : 'rgba(232,160,32,0.1)',
      border: `1px solid ${approved ? 'rgba(74,222,128,0.3)' : 'rgba(232,160,32,0.3)'}`,
      color: approved ? '#4ade80' : '#e8a020',
    }}>
      {approved ? 'Approved' : 'Pending'}
    </span>
  );
}

export default function CoachEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [watchVideoUrl, setWatchVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/coach/evaluations')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setEvaluations(data.evaluations ?? []);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load evaluations.');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Evaluations
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            All metric verifications you have submitted
          </p>
        </div>

        {loading && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>
        )}

        {!loading && error && (
          <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>
        )}

        {!loading && !error && evaluations.length === 0 && (
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1e2530',
            borderRadius: '0.75rem',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              No verifications submitted yet.
            </p>
          </div>
        )}

        {!loading && !error && evaluations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {evaluations.map(ev => (
              <div
                key={ev.id}
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1e2530',
                  borderRadius: '0.75rem',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Metric + value */}
                <div style={{ minWidth: '140px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    {ev.metricLabel}
                  </p>
                  <p style={{ color: '#e8a020', fontSize: '1.15rem', fontWeight: 700, margin: 0, fontFamily: 'Georgia, serif' }}>
                    {ev.value} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b7280' }}>{ev.metricUnit}</span>
                  </p>
                </div>

                {/* Athlete */}
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    Athlete
                  </p>
                  <a
                    href={`/profile/${ev.athleteClerkId}`}
                    style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#e8a020'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#f0f6fc'; }}
                  >
                    {ev.athleteName}
                  </a>
                </div>

                {/* Date */}
                <div style={{ minWidth: '100px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    Date
                  </p>
                  <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: 0 }}>
                    {formatDate(ev.createdAt)}
                  </p>
                </div>

                {/* AI confidence */}
                <div style={{ minWidth: '80px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    AI Score
                  </p>
                  <p style={{ color: ev.aiConfidence != null && ev.aiConfidence >= 70 ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    {ev.aiConfidence != null ? `${ev.aiConfidence}%` : '—'}
                  </p>
                </div>

                {/* Status */}
                <div style={{ minWidth: '80px' }}>
                  <StatusBadge status={ev.status} />
                </div>

                {/* Watch video */}
                {ev.videoUrl && (
                  <button
                    onClick={() => setWatchVideoUrl(toEmbedUrl(ev.videoUrl!))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: 'rgba(232,160,32,0.08)',
                      border: '1px solid rgba(232,160,32,0.3)',
                      borderRadius: '0.4rem',
                      color: '#e8a020',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '0.35rem 0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232,160,32,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232,160,32,0.08)'; }}
                  >
                    ▶ Watch Video
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Video player modal */}
      {watchVideoUrl && (
        <div
          onClick={() => setWatchVideoUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(13,17,23,0.92)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '800px',
              backgroundColor: '#111827',
              border: '1px solid #1e2530',
              borderRadius: '0.75rem',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
              borderBottom: '1px solid #1e2530',
            }}>
              <span style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '0.95rem' }}>
                Verification Video
              </span>
              <button
                onClick={() => setWatchVideoUrl(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem 0.5rem' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
              >
                &#x2715;
              </button>
            </div>
            <div style={{ backgroundColor: '#000', lineHeight: 0 }}>
              <iframe
                src={watchVideoUrl}
                style={{ width: '100%', height: '450px', border: 'none', display: 'block' }}
                allowFullScreen
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
