'use client';

import { useState } from 'react';
import MetricCard from '@/components/MetricCard';
import MetricsGraph from '@/components/MetricsGraph';
import MetricInputModal from '@/components/MetricInputModal';
import { METRIC_INFO, type AthleteMetric, type MetricKey } from '@/lib/metrics';
import Link from 'next/link';

interface Props {
  initialMetrics: AthleteMetric[];
}

// A compact subset of metrics shown on the main dashboard (not the full metrics page)
const DASHBOARD_METRIC_KEYS: MetricKey[] = [
  'exit_velocity',
  'fastball_velocity',
  'sixty_yard_dash',
  'infield_throwing_velocity',
  'outfield_throwing_velocity',
  'pop_time',
];

export default function AthleteDashboardMetrics({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState<AthleteMetric[]>(initialMetrics);
  const [graphMetricKey, setGraphMetricKey] = useState<MetricKey | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalDefault, setModalDefault] = useState<MetricKey | undefined>(undefined);

  // Only show metrics the athlete has data for, plus the standard dashboard set
  const keysWithData = Array.from(new Set([
    ...DASHBOARD_METRIC_KEYS,
    ...metrics.map(m => m.metric_key),
  ])) as MetricKey[];

  function getPersonalBest(key: MetricKey): AthleteMetric | null {
    return metrics.find(m => m.metric_key === key && m.is_personal_best) ?? null;
  }

  function getAllEntries(key: MetricKey): AthleteMetric[] {
    return metrics.filter(m => m.metric_key === key);
  }

  function openModal(key?: MetricKey) {
    setModalDefault(key);
    setShowModal(true);
  }

  function handleSaved(saved: AthleteMetric, demotedId: string | null) {
    setMetrics(prev => {
      let updated = prev.map(m =>
        demotedId && m.id === demotedId ? { ...m, is_personal_best: false } : m,
      );
      // If this metric already has a PB and this is now the new PB, demote the old one
      if (saved.is_personal_best) {
        updated = updated.map(m =>
          m.metric_key === saved.metric_key && m.is_personal_best && m.id !== saved.id
            ? { ...m, is_personal_best: false }
            : m,
        );
      }
      return [...updated, saved];
    });
    setShowModal(false);
  }

  const hasAnyMetric = metrics.length > 0;

  return (
    <>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          My Metrics
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => openModal()}
            style={{
              backgroundColor: '#e8a020',
              color: '#000000',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            + Add Metric
          </button>
          <Link
            href="/dashboard/athlete/metrics"
            style={{
              display: 'inline-block',
              background: 'transparent',
              border: '1px solid #374151',
              color: '#9ca3af',
              borderRadius: '0.5rem',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            View All →
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {!hasAnyMetric ? (
        <div style={{
          backgroundColor: '#111827',
          border: '1px dashed #1e2530',
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <p style={{ color: '#f0f6fc', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
            No metrics yet
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
            Add your first self-reported stat or book a session with a Diamond Verified coach to get verified.
          </p>
          <button
            type="button"
            onClick={() => openModal()}
            style={{
              backgroundColor: '#e8a020',
              color: '#000000',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Add Your First Metric
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {keysWithData.map(key => {
            const pb = getPersonalBest(key);
            const entries = getAllEntries(key);
            // Skip keys with no data that aren't in the dashboard set
            if (!pb && !DASHBOARD_METRIC_KEYS.includes(key)) return null;
            return (
              <div key={key} style={{ position: 'relative' }}>
                <MetricCard
                  metricKey={key}
                  personalBest={pb}
                  allEntries={entries}
                  onShowGraph={setGraphMetricKey}
                  onUploadVideo={() => openModal(key)}
                  onEnterValue={() => openModal(key)}
                  showUploadControls={false}
                />
                {/* Update button overlaid at bottom of card */}
                <button
                  type="button"
                  onClick={() => openModal(key)}
                  style={{
                    position: 'absolute',
                    bottom: '1.25rem',
                    right: '1.25rem',
                    background: 'transparent',
                    border: '1px solid #374151',
                    color: '#9ca3af',
                    borderRadius: '0.4rem',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                    (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151';
                    (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                  }}
                >
                  Update
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {hasAnyMetric && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {[
            { color: '#e8a020', label: 'Coach Verified' },
            { color: '#58a6ff', label: '3rd Party' },
            { color: '#6b7280', label: 'Self Reported' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: color, display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Graph modal */}
      {graphMetricKey !== null && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setGraphMetricKey(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '680px' }}>
            <MetricsGraph
              metricKey={graphMetricKey}
              entries={getAllEntries(graphMetricKey)}
              onClose={() => setGraphMetricKey(null)}
            />
          </div>
        </div>
      )}

      {/* Self-report input modal */}
      {showModal && (
        <MetricInputModal
          defaultMetricKey={modalDefault}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
