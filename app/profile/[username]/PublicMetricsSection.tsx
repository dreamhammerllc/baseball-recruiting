'use client';

import { useState } from 'react';
import MetricsGraph from '@/components/MetricsGraph';
import type { AthleteMetric, MetricKey } from '@/lib/metrics';
import { METRIC_INFO, VERIFICATION_LABELS } from '@/lib/metrics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  personalBestMetrics: AthleteMetric[];
  athleteClerkId: string;
}

interface GraphState {
  metricKey: MetricKey;
  entries: AthleteMetric[];
  loading: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string {
  if (!url) return '';
  if (url.includes('iframe.mediadelivery.net')) {
    return url.split('/').pop()?.split('?')[0] ?? '';
  }
  if (url.includes('vz-d9ee7f6e-2b7.b-cdn.net')) {
    return url.split('/')[3] ?? '';
  }
  return '';
}

export default function PublicMetricsSection({ personalBestMetrics, athleteClerkId }: Props) {
  const [graphState, setGraphState] = useState<GraphState | null>(null);
  const [watchVideoUrl, setWatchVideoUrl] = useState<string | null>(null);

  async function openGraph(metricKey: MetricKey) {
    // Show loading modal immediately
    setGraphState({ metricKey, entries: [], loading: true });

    try {
      const res = await fetch(
        `/api/metrics/public?athleteId=${encodeURIComponent(athleteClerkId)}&metricKey=${encodeURIComponent(metricKey)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch metric history');
      const { metrics } = (await res.json()) as { metrics: AthleteMetric[] };
      setGraphState({ metricKey, entries: metrics, loading: false });
    } catch {
      // On error, dismiss the modal
      setGraphState(null);
    }
  }

  function closeGraph() {
    setGraphState(null);
  }

  if (personalBestMetrics.length === 0) {
    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px dashed #1e2530',
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.5rem' }}>
          No verified metrics on file.
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#4b5563', margin: 0, lineHeight: 1.6 }}>
          Only coach-verified and third-party measurements appear on public profiles.
          Athletes can book a testing session with a Diamond Verified coach to get their metrics officially recorded.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Metrics chip grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {personalBestMetrics.map((metric) => {
          const info = METRIC_INFO[metric.metric_key];
          const verLabel = VERIFICATION_LABELS[metric.verification_type];
          const borderColor = verLabel?.color ?? '#6b7280';

          return (
            <div
              key={metric.id}
              style={{
                background: '#111827',
                border: '1px solid #1e2530',
                borderLeft: `2px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '0.875rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                position: 'relative',
              }}
            >
              {/* Label */}
              <p
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                  color: '#6b7280',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: 0,
                  paddingRight: '1.5rem',
                }}
              >
                {info?.label ?? metric.metric_key}
              </p>

              {/* Value */}
              <p
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#f0f6fc',
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {metric.value}
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginLeft: '0.25rem',
                    fontWeight: 400,
                  }}
                >
                  {info?.unit ?? metric.unit}
                </span>
              </p>

              {/* Verification badge */}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                  color: borderColor,
                  background: `${borderColor}18`,
                  border: `1px solid ${borderColor}40`,
                  borderRadius: '0.25rem',
                  padding: '0.1rem 0.4rem',
                  alignSelf: 'flex-start',
                  letterSpacing: '0.04em',
                }}
              >
                {verLabel?.shortLabel ?? metric.verification_type}
              </span>

              {/* Graph icon button */}
              <button
                onClick={() => openGraph(metric.metric_key)}
                title="View metric history"
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  color: '#e8a020',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0.25rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(232,160,32,0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {/* Line chart SVG icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </button>

              {/* Watch video button */}
              {metric.video_url && extractVideoId(metric.video_url) && (
                <button
                  onClick={() => setWatchVideoUrl(metric.video_url!)}
                  style={{
                    marginTop: '0.5rem',
                    background: 'rgba(232,160,32,0.08)',
                    border: '1px solid rgba(232,160,32,0.3)',
                    borderRadius: '0.375rem',
                    color: '#e8a020',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.6rem',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    alignSelf: 'flex-start',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,160,32,0.15)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,160,32,0.08)'; }}
                >
                  ▶ Watch
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Video modal */}
      {watchVideoUrl && (
        <div onClick={() => setWatchVideoUrl(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '720px',
            background: '#111827', borderRadius: '0.75rem', overflow: 'visible',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '1rem' }}>
              <span style={{ color: 'white', fontWeight: 600 }}>Verification Video</span>
              <button onClick={() => setWatchVideoUrl(null)} style={{
                background: 'none', border: 'none', color: 'white',
                fontSize: '1.25rem', cursor: 'pointer',
              }}>×</button>
            </div>
            <iframe
              src={`https://iframe.mediadelivery.net/embed/653202/${extractVideoId(watchVideoUrl)}?autoplay=false&preload=true`}
              width="100%"
              height="300"
              loading="lazy"
              style={{ border: 'none', display: 'block' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Graph modal */}
      {graphState && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGraph();
          }}
        >
          {graphState.loading ? (
            <div
              style={{
                background: '#111827',
                border: '1px solid #1e2530',
                borderRadius: '1rem',
                padding: '2rem 3rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                color: '#f0f6fc',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #1e2530',
                  borderTopColor: '#e8a020',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
                Loading history...
              </p>
              {/* Inline keyframes via a style tag */}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <MetricsGraph
              metricKey={graphState.metricKey}
              entries={graphState.entries}
              onClose={closeGraph}
            />
          )}
        </div>
      )}
    </>
  );
}
