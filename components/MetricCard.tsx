'use client';

import type { AthleteMetric, MetricKey } from '@/lib/metrics';
import { METRIC_INFO, VERIFICATION_LABELS } from '@/lib/metrics';

interface MetricCardProps {
  metricKey: MetricKey;
  personalBest: AthleteMetric | null;
  allEntries: AthleteMetric[];
  onShowGraph: (metricKey: MetricKey) => void;
  onUploadVideo: (metricKey: MetricKey) => void;
  onEnterValue?: (metricKey: MetricKey) => void;
  onWatchVideo?: (metricKey: MetricKey) => void;
  onViewCoachVerification?: (metricKey: MetricKey) => void;
  showUploadControls?: boolean;
}

function getBadgeColor(verificationType: string): string {
  if (verificationType === 'coach_verified') return '#e8a020';
  if (verificationType.startsWith('third_party')) return '#58a6ff';
  return '#6b7280';
}

export default function MetricCard({
  metricKey,
  personalBest,
  allEntries,
  onShowGraph,
  onUploadVideo,
  onEnterValue,
  onWatchVideo,
  onViewCoachVerification,
  showUploadControls = false,
}: MetricCardProps) {
  const info = METRIC_INFO[metricKey];
  const badgeColor = personalBest ? getBadgeColor(personalBest.verification_type) : '#6b7280';
  const badgeLabel = personalBest
    ? VERIFICATION_LABELS[personalBest.verification_type as keyof typeof VERIFICATION_LABELS]?.label
    : null;

  const isCoachVerified = personalBest?.verification_type === 'coach_verified';
  const badgeIsClickable = isCoachVerified && !!onViewCoachVerification;
  const rgb = badgeColor === '#e8a020' ? '232,160,32'
             : badgeColor === '#58a6ff' ? '88,166,255'
             : '107,114,128';

  const badgeBaseStyle: React.CSSProperties = {
    background:   `rgba(${rgb}, 0.12)`,
    border:       `1px solid rgba(${rgb}, 0.3)`,
    color:        badgeColor,
    borderRadius: '9999px',
    padding:      '0.15rem 0.6rem',
    fontSize:     '0.7rem',
    fontWeight:   600,
    whiteSpace:   'nowrap',
  };

  return (
    <div
      style={{
        background:     '#111827',
        border:         '1px solid #1e2530',
        borderRadius:   '0.75rem',
        padding:        '1.25rem',
        display:        'flex',
        flexDirection:  'column',
        gap:            '0.75rem',
        position:       'relative',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ color: '#f0f6fc', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: '0.95rem' }}>
          {info.label}
        </span>

        {badgeLabel && (
          badgeIsClickable ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewCoachVerification!(metricKey); }}
              style={{
                ...badgeBaseStyle,
                cursor:     'pointer',
                fontFamily: 'inherit',
                outline:    'none',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background    = `rgba(${rgb}, 0.22)`;
                (e.currentTarget as HTMLButtonElement).style.borderColor   = `rgba(${rgb}, 0.6)`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background    = `rgba(${rgb}, 0.12)`;
                (e.currentTarget as HTMLButtonElement).style.borderColor   = `rgba(${rgb}, 0.3)`;
              }}
              title="View coach verification details"
            >
              {badgeLabel}
            </button>
          ) : (
            <span style={{ ...badgeBaseStyle, cursor: 'default' }}>{badgeLabel}</span>
          )
        )}
      </div>

      {/* Value display */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
        {personalBest ? (
          <>
            <span style={{ fontSize: '2rem', fontFamily: 'monospace', color: '#f0f6fc', fontWeight: 700, lineHeight: 1 }}>
              {personalBest.value}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              {info.unit}
            </span>
            {info.lowerIsBetter && (
              <span
                style={{
                  color:      '#e8a020',
                  fontSize:   '0.9rem',
                  lineHeight: 1,
                  marginLeft: '0.2rem',
                  userSelect: 'none',
                }}
                title="Lower is better"
              >
                &#9660;
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '1.1rem', color: '#4b5563', fontStyle: 'italic' }}>
            No data
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem', position: 'relative', zIndex: 1 }}>
        {allEntries.length > 0 && (
          <button
            type="button"
            onClick={() => onShowGraph(metricKey)}
            style={{
              background:  'transparent',
              border:      '1px solid #4b5563',
              color:       '#9ca3af',
              borderRadius:'0.4rem',
              padding:     '0.3rem 0.75rem',
              fontSize:    '0.78rem',
              cursor:      'pointer',
              fontWeight:  500,
              transition:  'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
              (e.currentTarget as HTMLButtonElement).style.color       = '#f0f6fc';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
              (e.currentTarget as HTMLButtonElement).style.color       = '#9ca3af';
            }}
          >
            History
          </button>
        )}

        {showUploadControls && personalBest && personalBest.value === 0 && onEnterValue && (
          <button
            type="button"
            onClick={() => onEnterValue(metricKey)}
            style={{
              background:   'transparent',
              border:       '1px solid rgba(52,211,153,0.4)',
              color:        '#34d399',
              borderRadius: '0.4rem',
              padding:      '0.3rem 0.75rem',
              fontSize:     '0.78rem',
              cursor:       'pointer',
              fontWeight:   500,
              transition:   'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(52,211,153,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#34d399';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(52,211,153,0.4)';
            }}
          >
            Enter Value
          </button>
        )}

        {showUploadControls && personalBest && !personalBest.video_url && (
          <button
            type="button"
            onClick={() => onUploadVideo(metricKey)}
            style={{
              background:   'transparent',
              border:       '1px solid rgba(232,160,32,0.4)',
              color:        '#e8a020',
              borderRadius: '0.4rem',
              padding:      '0.3rem 0.75rem',
              fontSize:     '0.78rem',
              cursor:       'pointer',
              fontWeight:   500,
              transition:   'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(232,160,32,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8a020';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.4)';
            }}
          >
            Upload Video
          </button>
        )}

        {showUploadControls && !personalBest && (
          <button
            type="button"
            onClick={() => onUploadVideo(metricKey)}
            style={{
              background:   'transparent',
              border:       '1px solid rgba(232,160,32,0.4)',
              color:        '#e8a020',
              borderRadius: '0.4rem',
              padding:      '0.3rem 0.75rem',
              fontSize:     '0.78rem',
              cursor:       'pointer',
              fontWeight:   500,
              transition:   'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(232,160,32,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8a020';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.4)';
            }}
          >
            Upload Video
          </button>
        )}

        {personalBest?.video_url && onWatchVideo && (
          <button
            type="button"
            onClick={() => onWatchVideo(metricKey)}
            style={{
              background:   'transparent',
              border:       '1px solid rgba(88,166,255,0.4)',
              color:        '#58a6ff',
              borderRadius: '0.4rem',
              padding:      '0.3rem 0.75rem',
              fontSize:     '0.78rem',
              cursor:       'pointer',
              fontWeight:   500,
              transition:   'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(88,166,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#58a6ff';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background  = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(88,166,255,0.4)';
            }}
          >
            Watch
          </button>
        )}

        {personalBest?.video_url && !onWatchVideo && (
          <a
            href={personalBest.video_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background:     'transparent',
              border:         '1px solid rgba(88,166,255,0.4)',
              color:          '#58a6ff',
              borderRadius:   '0.4rem',
              padding:        '0.3rem 0.75rem',
              fontSize:       '0.78rem',
              cursor:         'pointer',
              fontWeight:     500,
              textDecoration: 'none',
              display:        'inline-block',
              transition:     'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background  = 'rgba(88,166,255,0.08)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = '#58a6ff';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background  = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(88,166,255,0.4)';
            }}
          >
            Watch
          </a>
        )}
      </div>
    </div>
  );
}
