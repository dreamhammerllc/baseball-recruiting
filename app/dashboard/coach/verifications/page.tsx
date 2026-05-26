'use client';

import { useState, useEffect } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';
import { getVideoPlaybackInfo } from '@/lib/videoPlayback';
import type { Evaluation } from '@/app/api/coach/verifications/route';

export const dynamic = 'force-dynamic';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function reasonLabel(reason: string | null): string {
  if (!reason) return '';
  if (reason.startsWith('device_divergence')) return 'Device reading disagreed with the claimed value';
  if (reason.startsWith('history_jump')) return 'Large jump from this athlete’s established value';
  if (reason.startsWith('ai_confidence')) return 'AI plausibility check was low-confidence';
  if (reason.startsWith('fail-closed')) return 'Auto-check could not complete';
  return reason;
}

function reasonText(ev: Evaluation): string {
  if (ev.status === 'rejected' && ev.reviewNote) return ev.reviewNote;
  return reasonLabel(ev.decisionReason);
}

function StatusBadge({ status }: { status: string }) {
  let bg = 'rgba(232,160,32,0.1)', border = 'rgba(232,160,32,0.3)', color = '#e8a020', label = 'Under review';
  if (status === 'approved') { bg = 'rgba(74,222,128,0.1)'; border = 'rgba(74,222,128,0.3)'; color = '#4ade80'; label = 'Approved'; }
  else if (status === 'rejected') { bg = 'rgba(248,81,73,0.1)'; border = 'rgba(248,81,73,0.35)'; color = '#f85149'; label = 'Rejected'; }
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '9999px',
      fontSize: '0.7rem', fontWeight: 700, backgroundColor: bg, border: `1px solid ${border}`, color,
    }}>
      {label}
    </span>
  );
}

export default function CoachEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [watchVideoUrl, setWatchVideoUrl] = useState<string | null>(null);
  const [appealingId, setAppealingId] = useState<string | null>(null);

  const playbackInfo = watchVideoUrl ? getVideoPlaybackInfo(watchVideoUrl) : null;

  useEffect(() => {
    fetch('/api/coach/verifications')
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

  async function appeal(ev: Evaluation) {
    if (!ev.sessionId) return;
    setAppealingId(ev.id);
    setError(null);
    try {
      const res = await fetch('/api/metrics/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ev.sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setEvaluations(prev => prev.map(e => e.id === ev.id ? { ...e, status: 'flagged', reviewRequested: true } : e));
    } catch (e: any) {
      setError(e.message || 'Failed to file appeal.');
    } finally {
      setAppealingId(null);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Verifications
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
            backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem',
            padding: '3rem 2rem', textAlign: 'center',
          }}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              No verifications submitted yet.
            </p>
          </div>
        )}

        {!loading && !error && evaluations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {evaluations.map(ev => {
              const showReviewLine = ev.status === 'flagged' || ev.status === 'rejected';
              return (
              <div
                key={ev.id}
                style={{
                  backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem',
                  padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: '140px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    {ev.metricLabel}
                  </p>
                  <p style={{ color: '#e8a020', fontSize: '1.15rem', fontWeight: 700, margin: 0, fontFamily: 'Georgia, serif' }}>
                    {ev.value} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b7280' }}>{ev.metricUnit}</span>
                  </p>
                </div>

                <div style={{ flex: 1, minWidth: '140px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    Athlete
                  </p>
                  <a
                    href={`/profile/${ev.athleteUsername ?? ev.athleteClerkId}`}
                    style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#e8a020'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#f0f6fc'; }}
                  >
                    {ev.athleteName}
                  </a>
                </div>

                <div style={{ minWidth: '100px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    Date
                  </p>
                  <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: 0 }}>
                    {formatDate(ev.createdAt)}
                  </p>
                </div>

                <div style={{ minWidth: '80px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem', fontWeight: 600 }}>
                    AI Score
                  </p>
                  <p style={{ color: ev.aiConfidence != null && ev.aiConfidence >= 70 ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                    {ev.aiConfidence != null ? `${ev.aiConfidence}%` : '—'}
                  </p>
                </div>

                <div style={{ minWidth: '90px' }}>
                  <StatusBadge status={ev.status} />
                </div>

                {ev.videoUrl && getVideoPlaybackInfo(ev.videoUrl).kind !== 'unsupported' && (
                  <button
                    onClick={() => setWatchVideoUrl(ev.videoUrl!)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      backgroundColor: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.3)',
                      borderRadius: '0.4rem', color: '#e8a020', fontSize: '0.78rem', fontWeight: 600,
                      padding: '0.35rem 0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232,160,32,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(232,160,32,0.08)'; }}
                  >
                    ▶ Watch Video
                  </button>
                )}

                {showReviewLine && (
                  <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginTop: '0.15rem', paddingTop: '0.75rem', borderTop: '1px solid #1e2530' }}>
                    <span style={{ color: ev.status === 'rejected' ? '#f87171' : '#e8a020', fontSize: '0.78rem' }}>
                      {ev.status === 'rejected' ? 'Rejected' : 'Under review'}{reasonText(ev) ? ` — ${reasonText(ev)}` : ''}
                    </span>
                    {ev.status === 'rejected' && ev.sessionId && (
                      <button
                        onClick={() => appeal(ev)}
                        disabled={appealingId === ev.id}
                        style={{
                          backgroundColor: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.4)',
                          borderRadius: '0.4rem', color: '#e8a020', fontSize: '0.75rem', fontWeight: 600,
                          padding: '0.3rem 0.75rem', cursor: appealingId === ev.id ? 'default' : 'pointer',
                          opacity: appealingId === ev.id ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {appealingId === ev.id ? 'Sending…' : 'Appeal / request re-review'}
                      </button>
                    )}
                    {ev.status === 'flagged' && ev.reviewRequested && (
                      <span style={{ color: '#58a6ff', fontSize: '0.72rem', fontWeight: 600 }}>Re-review requested</span>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

      </main>

      {watchVideoUrl && playbackInfo && (
        <div
          onClick={() => setWatchVideoUrl(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(13,17,23,0.92)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '800px', backgroundColor: '#111827',
              border: '1px solid #1e2530', borderRadius: '0.75rem', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.875rem 1.25rem', borderBottom: '1px solid #1e2530',
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
            {playbackInfo.kind === 'mp4' && (
              <video src={playbackInfo.src} controls autoPlay style={{ display: 'block', width: '100%', height: '300px', background: '#000', border: 'none' }} />
            )}
            {playbackInfo.kind === 'iframe' && (
              <iframe src={playbackInfo.src} width="100%" height="300" loading="lazy" style={{ border: 'none', display: 'block' }} allow="autoplay; fullscreen" allowFullScreen />
            )}
            {playbackInfo.kind === 'unsupported' && (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.55 }}>
                This video format isn&apos;t supported by the current player.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
