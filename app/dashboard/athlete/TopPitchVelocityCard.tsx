'use client';

import { useState } from 'react';
import Link from 'next/link';
import MetricsGraph from '@/components/MetricsGraph';
import { PITCH_TYPE_LABELS, VERIFICATION_LABELS } from '@/lib/metrics';
import type { AthleteMetric, AthletePitch, MetricKey } from '@/lib/metrics';

const ARSENAL_HREF = '/dashboard/athlete/metrics';

type TopPitch = Pick<
  AthletePitch,
  'id' | 'pitch_slot' | 'pitch_type' | 'velocity' | 'verification_type' | 'source_label'
>;

interface Props {
  topPitch: TopPitch | null;
  arsenalCount: number;
  historyMetricKey: MetricKey | null;
  historyEntries: AthleteMetric[];
}

// Same mapping the hitting cards / MetricsGraph use.
function getBadgeColor(verificationType: string): string {
  if (verificationType === 'coach_verified') return '#e8a020';
  if (verificationType.startsWith('third_party')) return '#58a6ff';
  return '#6b7280';
}

const neutralBtnStyle: React.CSSProperties = {
  background:     'transparent',
  border:         '1px solid #4b5563',
  color:          '#9ca3af',
  borderRadius:   '0.4rem',
  padding:        '0.3rem 0.75rem',
  fontSize:       '0.78rem',
  cursor:         'pointer',
  fontWeight:     500,
  textDecoration: 'none',
  display:        'inline-block',
  transition:     'border-color 0.15s, color 0.15s',
};

const accentBtnStyle: React.CSSProperties = {
  background:     'transparent',
  border:         '1px solid rgba(232,160,32,0.4)',
  color:          '#e8a020',
  borderRadius:   '0.4rem',
  padding:        '0.3rem 0.75rem',
  fontSize:       '0.78rem',
  cursor:         'pointer',
  fontWeight:     500,
  textDecoration: 'none',
  display:        'inline-block',
  transition:     'border-color 0.15s, background 0.15s',
};

function neutralEnter(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = '#6b7280';
  e.currentTarget.style.color       = '#f0f6fc';
}
function neutralLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = '#4b5563';
  e.currentTarget.style.color       = '#9ca3af';
}
function accentEnter(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.background  = 'rgba(232,160,32,0.08)';
  e.currentTarget.style.borderColor = '#e8a020';
}
function accentLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.background  = 'transparent';
  e.currentTarget.style.borderColor = 'rgba(232,160,32,0.4)';
}

export default function TopPitchVelocityCard({
  topPitch,
  arsenalCount,
  historyMetricKey,
  historyEntries,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);

  const showHistoryButton =
    !!topPitch && historyMetricKey !== null && historyEntries.length > 0;

  let badge:  React.ReactNode = null;
  let body:   React.ReactNode;
  let footer: React.ReactNode;

  if (arsenalCount === 0) {
    body = (
      <span style={{ fontSize: '1.1rem', color: '#4b5563', fontStyle: 'italic' }}>
        No pitches yet
      </span>
    );
    footer = (
      <Link
        href={ARSENAL_HREF}
        style={accentBtnStyle}
        onMouseEnter={accentEnter}
        onMouseLeave={accentLeave}
      >
        Add a Pitch
      </Link>
    );
  } else if (!topPitch) {
    body = (
      <span style={{ fontSize: '1.1rem', color: '#4b5563', fontStyle: 'italic' }}>
        Velocity not yet measured
      </span>
    );
    footer = (
      <Link
        href={ARSENAL_HREF}
        style={neutralBtnStyle}
        onMouseEnter={neutralEnter}
        onMouseLeave={neutralLeave}
      >
        View Arsenal
      </Link>
    );
  } else {
    const badgeColor = getBadgeColor(topPitch.verification_type);
    const rgb = badgeColor === '#e8a020' ? '232,160,32'
              : badgeColor === '#58a6ff' ? '88,166,255'
              : '107,114,128';
    const badgeLabel =
      VERIFICATION_LABELS[topPitch.verification_type as keyof typeof VERIFICATION_LABELS]?.label;

    badge = badgeLabel ? (
      <span
        style={{
          background:   `rgba(${rgb}, 0.12)`,
          border:       `1px solid rgba(${rgb}, 0.3)`,
          color:        badgeColor,
          borderRadius: '9999px',
          padding:      '0.15rem 0.6rem',
          fontSize:     '0.7rem',
          fontWeight:   600,
          whiteSpace:   'nowrap',
        }}
      >
        {badgeLabel}
      </span>
    ) : null;

    body = (
      <>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#f0f6fc', fontWeight: 700, lineHeight: 1 }}>
            {topPitch.velocity}
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>mph</span>
        </div>
        <span style={{ color: '#9ca3af', fontSize: '0.82rem', fontWeight: 500 }}>
          {PITCH_TYPE_LABELS[topPitch.pitch_type]}
        </span>
      </>
    );

    footer = (
      <>
        <Link
          href={ARSENAL_HREF}
          style={neutralBtnStyle}
          onMouseEnter={neutralEnter}
          onMouseLeave={neutralLeave}
        >
          View Arsenal
        </Link>
        {showHistoryButton && (
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            style={{ ...neutralBtnStyle, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={neutralEnter}
            onMouseLeave={neutralLeave}
          >
            History
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
        Pitching
      </h2>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap:                 '1rem',
        }}
      >
        <div
          style={{
            background:    '#111827',
            border:        '1px solid #1e2530',
            borderRadius:  '0.75rem',
            padding:       '1.25rem',
            display:       'flex',
            flexDirection: 'column',
            gap:           '0.75rem',
            position:      'relative',
          }}
        >
          {/* Header row: title + verification badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: '#f0f6fc', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: '0.95rem' }}>
              Top Pitch Velocity
            </span>
            {badge}
          </div>

          {/* Body — number + pitch type, or the empty / not-measured state */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {body}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {footer}
          </div>

          {/* Secondary count line */}
          <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>
            {arsenalCount} of 5 pitches in arsenal
          </span>
        </div>
      </div>

      {showHistory && historyMetricKey !== null && (
        <MetricsGraph
          metricKey={historyMetricKey}
          entries={historyEntries}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
