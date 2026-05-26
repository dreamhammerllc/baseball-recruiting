'use client';

import { useState } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';

export type ReviewItem = {
  sessionId: string;
  athleteName: string;
  coachName: string;
  metricKey: string;
  metricLabel: string;
  unit: string;
  claimedValue: number;
  deviceValue: number | null;
  videoUrl: string | null;
  readoutFileUrl: string | null;
  aiConfidence: number | null;
  aiNotes: string | null;
  decisionReason: string | null;
  createdAt: string;
  reviewRequested: boolean;
  reviewRequestedAt: string | null;
};

function reasonLabel(reason: string | null): string {
  if (!reason) return 'Flagged for review';
  if (reason.startsWith('device_divergence')) return 'Device reading disagreed with the claimed value';
  if (reason.startsWith('history_jump')) return 'Large jump from this athlete’s established value';
  if (reason.startsWith('ai_confidence')) return 'AI plausibility check was low-confidence';
  if (reason.startsWith('fail-closed')) return 'Auto-check could not complete (held for review)';
  return reason;
}

function fileKind(url: string): 'image' | 'pdf' | 'other' {
  const u = url.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(u)) return 'image';
  if (u.endsWith('.pdf')) return 'pdf';
  return 'other';
}

export default function ReviewQueueClient({ initialItems }: { initialItems: ReviewItem[] }) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceItem, setEvidenceItem] = useState<ReviewItem | null>(null);

  async function resolve(sessionId: string, action: 'approve' | 'reject') {
    setBusyId(sessionId);
    setError(null);
    try {
      const res = await fetch('/api/review/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setItems(prev => prev.filter(i => i.sessionId !== sessionId));
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: 32, maxWidth: 900 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Review Queue</h1>
        <p style={{ color: '#8b949e', marginBottom: 24 }}>
          Flagged metrics awaiting a human decision. Approving publishes the metric to the athlete&rsquo;s profile as coach-verified.
        </p>

        {error && (
          <div style={{ background: '#3d1418', border: '1px solid #f85149', color: '#ffa198', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ color: '#8b949e', padding: '48px 0', textAlign: 'center' }}>
            Nothing in the queue. All flagged metrics have been reviewed.
          </div>
        ) : (
          items.map(item => {
            const busy = busyId === item.sessionId;
            const hasEvidence = Boolean(item.videoUrl || item.readoutFileUrl);
            return (
              <div key={item.sessionId} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                {item.reviewRequested && (
                  <div style={{ display: 'inline-block', background: '#1f2d3d', color: '#58a6ff', fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, marginBottom: 10 }}>
                    Appeal requested
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{item.athleteName}</div>
                    <div style={{ color: '#8b949e', fontSize: 14 }}>{item.metricLabel}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#58a6ff' }}>
                      {item.claimedValue}{item.unit ? ` ${item.unit}` : ''}
                    </div>
                    <div style={{ color: '#8b949e', fontSize: 12 }}>claimed</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, padding: '10px 12px', background: '#0d1117', borderRadius: 8, fontSize: 14 }}>
                  <div style={{ color: '#f0a020', fontWeight: 600, marginBottom: 4 }}>{reasonLabel(item.decisionReason)}</div>
                  {item.deviceValue != null && (
                    <div style={{ color: '#8b949e' }}>Device read: <strong style={{ color: '#e6edf3' }}>{item.deviceValue}{item.unit ? ` ${item.unit}` : ''}</strong></div>
                  )}
                  {item.aiConfidence != null && (
                    <div style={{ color: '#8b949e' }}>AI confidence: {item.aiConfidence}%</div>
                  )}
                  {item.aiNotes && (
                    <div style={{ color: '#8b949e', marginTop: 4 }}>{item.aiNotes}</div>
                  )}
                </div>

                <div style={{ marginTop: 12, fontSize: 13, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span>Submitted by {item.coachName}</span>
                  {hasEvidence ? (
                    <button onClick={() => setEvidenceItem(item)}
                      style={{ background: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      View evidence{item.videoUrl && item.readoutFileUrl ? ' (video + readout)' : item.videoUrl ? ' (video)' : ' (readout)'}
                    </button>
                  ) : (
                    <span>no evidence attached</span>
                  )}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button onClick={() => resolve(item.sessionId, 'approve')} disabled={busy}
                    style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy ? '…' : 'Approve & publish'}
                  </button>
                  <button onClick={() => resolve(item.sessionId, 'reject')} disabled={busy}
                    style={{ background: 'transparent', color: '#f85149', border: '1px solid #f85149', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    {busy ? '…' : 'Reject'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

      {evidenceItem && (
        <div onClick={() => setEvidenceItem(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{evidenceItem.athleteName}</div>
                <div style={{ color: '#8b949e', fontSize: 14 }}>
                  {evidenceItem.metricLabel} — claimed {evidenceItem.claimedValue}{evidenceItem.unit ? ` ${evidenceItem.unit}` : ''}
                  {evidenceItem.deviceValue != null ? ` · device read ${evidenceItem.deviceValue}${evidenceItem.unit ? ` ${evidenceItem.unit}` : ''}` : ''}
                </div>
              </div>
              <button onClick={() => setEvidenceItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            {evidenceItem.videoUrl && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', marginBottom: 6 }}>Video</div>
                <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                  <iframe
                    src={evidenceItem.videoUrl.includes('?') ? evidenceItem.videoUrl : `${evidenceItem.videoUrl}?preload=true&responsive=true`}
                    loading="lazy"
                    allow="accelerated-2d-canvas; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              </div>
            )}

            {evidenceItem.readoutFileUrl && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', marginBottom: 6 }}>Device readout</div>
                {fileKind(evidenceItem.readoutFileUrl) === 'image' && (
                  <img src={evidenceItem.readoutFileUrl} alt="Device readout" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                )}
                {fileKind(evidenceItem.readoutFileUrl) === 'pdf' && (
                  <iframe src={evidenceItem.readoutFileUrl} title="Device readout" style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8 }} />
                )}
                <div style={{ marginTop: 8 }}>
                  <a href={evidenceItem.readoutFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', fontSize: 13 }}>Open readout in new tab</a>
                </div>
              </div>
            )}

            {!evidenceItem.videoUrl && !evidenceItem.readoutFileUrl && (
              <div style={{ color: '#8b949e' }}>No video or document was attached to this submission.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
