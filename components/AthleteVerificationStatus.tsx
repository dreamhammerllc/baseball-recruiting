'use client';

import { useState } from 'react';

export type AthleteReviewItem = {
  sessionId: string;
  metricLabel: string;
  unit: string;
  value: number;
  status: string;
  decisionReason: string | null;
  reviewNote: string | null;
  reviewRequested: boolean;
  coachName: string;
};

function reasonLabel(reason: string | null): string {
  if (!reason) return '';
  if (reason.startsWith('device_divergence')) return 'Device reading disagreed with the claimed value';
  if (reason.startsWith('history_jump')) return 'Large jump from your established value';
  if (reason.startsWith('ai_confidence')) return 'AI plausibility check was low-confidence';
  if (reason.startsWith('fail-closed')) return 'Auto-check could not complete';
  return reason;
}

function reasonText(item: AthleteReviewItem): string {
  if (item.status === 'rejected' && item.reviewNote) return item.reviewNote;
  return reasonLabel(item.decisionReason);
}

export default function AthleteVerificationStatus({ initialItems }: { initialItems: AthleteReviewItem[] }) {
  const [items, setItems] = useState<AthleteReviewItem[]>(initialItems);
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function appeal(item: AthleteReviewItem) {
    setAppealingId(item.sessionId);
    setError(null);
    try {
      const res = await fetch('/api/metrics/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: item.sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setItems(prev => prev.map(i => i.sessionId === item.sessionId ? { ...i, status: 'flagged', reviewRequested: true } : i));
    } catch (e: any) {
      setError(e.message || 'Failed to send appeal.');
    } finally {
      setAppealingId(null);
    }
  }

  return (
    <>
      <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem' }}>
        Verification status
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        Metrics a coach submitted on your behalf that are still being checked. Approved metrics appear in My Metrics above.
      </p>

      {error && (
        <div style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.35)', color: '#ffa198', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(item => {
          const rejected = item.status === 'rejected';
          const reason = reasonText(item);
          const busy = appealingId === item.sessionId;
          return (
            <div key={item.sessionId} style={{
              backgroundColor: '#0d1117',
              border: '1px solid #1e2530',
              borderRadius: '0.6rem',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#f0f6fc', fontSize: '0.92rem', fontWeight: 700 }}>
                    {item.metricLabel}
                  </span>
                  <span style={{ color: '#e8a020', fontSize: '0.92rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>
                    {item.value}{item.unit ? ` ${item.unit}` : ''}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>
                    submitted by {item.coachName}
                  </span>
                </div>
                {reason && (
                  <div style={{ color: rejected ? '#f87171' : '#d4911c', fontSize: '0.76rem', marginTop: '0.25rem' }}>
                    {rejected ? 'Rejected' : 'Under review'} — {reason}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.15rem 0.6rem',
                  borderRadius: '9999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: rejected ? 'rgba(248,81,73,0.1)' : 'rgba(232,160,32,0.1)',
                  border: `1px solid ${rejected ? 'rgba(248,81,73,0.35)' : 'rgba(232,160,32,0.3)'}`,
                  color: rejected ? '#f85149' : '#e8a020',
                }}>
                  {rejected ? 'Rejected' : 'Under review'}
                </span>

                {rejected ? (
                  <button
                    type="button"
                    onClick={() => appeal(item)}
                    disabled={busy}
                    style={{
                      background: 'transparent',
                      border: '1px solid #374151',
                      color: busy ? '#6b7280' : '#9ca3af',
                      borderRadius: '0.4rem',
                      padding: '0.25rem 0.7rem',
                      fontSize: '0.72rem',
                      cursor: busy ? 'default' : 'pointer',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {busy ? 'Sending…' : 'Appeal'}
                  </button>
                ) : item.reviewRequested ? (
                  <span style={{ color: '#58a6ff', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Re-review requested
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
