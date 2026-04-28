'use client';

import { useState, useEffect } from 'react';
import type { AthleteMetric, MetricKey } from '@/lib/metrics';
import { METRIC_INFO, VERIFICATION_LABELS } from '@/lib/metrics';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterWindow = 'all' | '365' | '90' | '30';

interface MetricsGraphProps {
  metricKey: MetricKey;
  entries: AthleteMetric[];
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<FilterWindow, string> = {
  all:   'All Time',
  '365': 'Last 365 Days',
  '90':  'Last 90 Days',
  '30':  'Last 30 Days',
};

const FILTER_ORDER: FilterWindow[] = ['all', '365', '90', '30'];

const MS_PER_DAY = 86_400_000;

const WINDOW_MS: Record<FilterWindow, number | null> = {
  all:   null,
  '365': 365 * MS_PER_DAY,
  '90':  90  * MS_PER_DAY,
  '30':  30  * MS_PER_DAY,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDateShort(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getBadgeColor(verificationType: string): string {
  if (verificationType === 'coach_verified') return '#e8a020';
  if (verificationType.startsWith('third_party')) return '#58a6ff';
  return '#6b7280';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricsGraph({ metricKey, entries, onClose }: MetricsGraphProps) {
  const [filter, setFilter] = useState<FilterWindow>('all');
  const info = METRIC_INFO[metricKey];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Exclude placeholder (value=0) rows from all calculations
  const validEntries = entries.filter(e => e.value > 0);

  // Personal best across all valid entries
  const personalBest = validEntries.length > 0
    ? validEntries.reduce((best, e) =>
        info.lowerIsBetter
          ? (e.value < best.value ? e : best)
          : (e.value > best.value ? e : best),
      )
    : null;

  // Entries within the selected time window
  const now = Date.now();
  const windowMs = WINDOW_MS[filter];
  const filteredEntries = validEntries.filter(e => {
    if (windowMs === null) return true;
    return (now - new Date(e.recorded_at).getTime()) <= windowMs;
  });

  const avg = filteredEntries.length > 0
    ? filteredEntries.reduce((sum, e) => sum + e.value, 0) / filteredEntries.length
    : null;

  // Y-scale from ALL valid entries (stable across filter changes)
  const allValues  = validEntries.map(e => e.value);
  const yMin       = allValues.length > 0 ? Math.min(...allValues) : 0;
  const yMax       = allValues.length > 0 ? Math.max(...allValues) : 100;
  const yRange     = yMax === yMin ? 1 : yMax - yMin;

  // Y-axis labels: top = best direction, bottom = worst
  const yTopLabel  = (info.lowerIsBetter ? yMin : yMax).toFixed(1);
  const yMidLabel  = ((yMin + yMax) / 2).toFixed(1);
  const yBotLabel  = (info.lowerIsBetter ? yMax : yMin).toFixed(1);

  // X-axis window start
  const windowStart: Date = (() => {
    if (windowMs === null) {
      if (validEntries.length === 0) return new Date(now);
      return new Date(Math.min(...validEntries.map(e => new Date(e.recorded_at).getTime())));
    }
    return new Date(now - windowMs);
  })();

  // SVG layout
  const VB_W      = 600;
  const VB_H      = 200;
  const PAD_L     = 44;
  const PAD_T     = 16;
  const PAD_R     = 16;
  const PAD_B     = 32;
  const PLOT_W    = VB_W - PAD_L - PAD_R;
  const PLOT_H    = VB_H - PAD_T - PAD_B;
  const gridYs    = [PAD_T, PAD_T + PLOT_H / 2, PAD_T + PLOT_H];

  // Vertical position of the average line
  const avgYFrac  = avg !== null
    ? (info.lowerIsBetter
        ? (avg - yMin) / yRange
        : 1 - (avg - yMin) / yRange)
    : 0.5;
  const avgY      = PAD_T + avgYFrac * PLOT_H;

  // Badge styles for personal best
  const badgeColor = personalBest ? getBadgeColor(personalBest.verification_type) : '#6b7280';
  const badgeRgb   = badgeColor === '#e8a020' ? '232,160,32'
                   : badgeColor === '#58a6ff' ? '88,166,255'
                   : '107,114,128';

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.80)',
        zIndex:          200,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    '#0d1117',
          border:        '1px solid #1e2530',
          borderRadius:  '1rem',
          padding:       '1.75rem',
          maxWidth:      '680px',
          width:         '90%',
          maxHeight:     '85vh',
          overflowY:     'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   '0.5rem',
          }}
        >
          <span
            style={{
              color:      '#f0f6fc',
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              fontSize:   '1.1rem',
            }}
          >
            {info.label}
          </span>
          <button
            onClick={onClose}
            style={{
              background:   'transparent',
              border:       '1px solid #1e2530',
              color:        '#6b7280',
              borderRadius: '0.4rem',
              padding:      '0.25rem 0.6rem',
              cursor:       'pointer',
              fontSize:     '0.9rem',
              lineHeight:   1,
              fontWeight:   600,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            &#x2715;
          </button>
        </div>

        {/* ── Personal best ────────────────────────────────────────────────── */}
        {personalBest && (
          <div style={{ marginBottom: '1.25rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>Personal Best: </span>
            <span
              style={{
                color:      badgeColor,
                fontWeight: 700,
                fontSize:   '0.95rem',
                fontFamily: 'monospace',
              }}
            >
              {personalBest.value}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.82rem', marginLeft: '0.25rem' }}>
              {info.unit}
            </span>
            <span
              style={{
                marginLeft:  '0.5rem',
                background:  `rgba(${badgeRgb}, 0.12)`,
                border:      `1px solid rgba(${badgeRgb}, 0.3)`,
                color:       badgeColor,
                borderRadius:'9999px',
                padding:     '0.1rem 0.5rem',
                fontSize:    '0.7rem',
                fontWeight:  600,
              }}
            >
              {VERIFICATION_LABELS[personalBest.verification_type as keyof typeof VERIFICATION_LABELS]?.label}
            </span>
          </div>
        )}

        {/* ── Filter buttons ───────────────────────────────────────────────── */}
        <div
          style={{
            display:       'flex',
            gap:           '0.5rem',
            marginBottom:  '1.5rem',
            flexWrap:      'wrap',
          }}
        >
          {FILTER_ORDER.map(f => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background:   active ? '#e8a020' : 'transparent',
                  border:       `1px solid ${active ? '#e8a020' : '#374151'}`,
                  color:        active ? '#000000' : '#6b7280',
                  borderRadius: '9999px',
                  padding:      '0.3rem 0.875rem',
                  fontSize:     '0.78rem',
                  fontWeight:   active ? 700 : 500,
                  cursor:       'pointer',
                  transition:   'background 0.15s, color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151';
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {validEntries.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding:   '3rem 0',
              color:     '#4b5563',
              fontSize:  '0.95rem',
            }}
          >
            No data yet
          </div>
        ) : filteredEntries.length === 0 ? (
          <div
            style={{
              textAlign:    'center',
              padding:      '2.5rem 0',
              color:        '#4b5563',
              fontSize:     '0.9rem',
            }}
          >
            No sessions in this period
          </div>
        ) : (
          <>
            {/* ── Average display card ────────────────────────────────────── */}
            <div
              style={{
                background:    '#111827',
                border:        '1px solid #1e2530',
                borderRadius:  '0.75rem',
                padding:       '1.25rem 1rem',
                marginBottom:  '1.25rem',
                textAlign:     'center',
              }}
            >
              <div
                style={{
                  color:          '#6b7280',
                  fontSize:       '0.7rem',
                  fontWeight:     600,
                  textTransform:  'uppercase',
                  letterSpacing:  '0.07em',
                  marginBottom:   '0.4rem',
                }}
              >
                Average
              </div>
              <div
                style={{
                  fontSize:   '3rem',
                  fontFamily: 'monospace',
                  color:      '#e8a020',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {avg!.toFixed(1)}
              </div>
              <div
                style={{
                  color:     '#9ca3af',
                  fontSize:  '0.875rem',
                  marginTop: '0.3rem',
                }}
              >
                {info.unit}
              </div>
              <div
                style={{
                  color:     '#4b5563',
                  fontSize:  '0.78rem',
                  marginTop: '0.5rem',
                }}
              >
                Based on {filteredEntries.length} session{filteredEntries.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* ── Session list ────────────────────────────────────────────── */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  color:          '#6b7280',
                  fontSize:       '0.7rem',
                  fontWeight:     600,
                  textTransform:  'uppercase',
                  letterSpacing:  '0.07em',
                  marginBottom:   '0.625rem',
                }}
              >
                Sessions
              </div>
              <div
                style={{
                  border:       '1px solid #1e2530',
                  borderRadius: '0.5rem',
                  overflow:     'hidden',
                }}
              >
                {[...filteredEntries]
                  .sort((a, b) =>
                    new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
                  )
                  .map((entry, i) => {
                    const bColor = getBadgeColor(entry.verification_type);
                    const bRgb   = bColor === '#e8a020' ? '232,160,32'
                                 : bColor === '#58a6ff' ? '88,166,255'
                                 : '107,114,128';
                    const bLabel =
                      VERIFICATION_LABELS[
                        entry.verification_type as keyof typeof VERIFICATION_LABELS
                      ]?.shortLabel ?? entry.verification_type;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'space-between',
                          gap:            '0.75rem',
                          padding:        '0.625rem 0.875rem',
                          background:     '#111827',
                          borderTop:      i > 0 ? '1px solid #1e2530' : 'none',
                        }}
                      >
                        <span style={{ color: '#6b7280', fontSize: '0.78rem', flexShrink: 0 }}>
                          {formatDate(entry.recorded_at)}
                        </span>
                        <span style={{ color: '#4b5563', fontSize: '0.75rem', flex: 1, textAlign: 'center' }}>
                          {entry.source_label ?? ''}
                        </span>
                        <span style={{ color: '#f0f6fc', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                          {entry.value}
                          <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                            {info.unit}
                          </span>
                        </span>
                        <span
                          style={{
                            background:   `rgba(${bRgb}, 0.12)`,
                            border:       `1px solid rgba(${bRgb}, 0.25)`,
                            color:        bColor,
                            borderRadius: '9999px',
                            padding:      '0.15rem 0.55rem',
                            fontSize:     '0.7rem',
                            fontWeight:   600,
                            whiteSpace:   'nowrap',
                            flexShrink:   0,
                          }}
                        >
                          {bLabel}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* ── Average line chart ──────────────────────────────────────── */}
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              style={{ width: '100%', height: '200px', display: 'block' }}
            >
              {/* Grid lines */}
              {gridYs.map((gy, i) => (
                <line
                  key={i}
                  x1={PAD_L}      y1={gy}
                  x2={PAD_L + PLOT_W} y2={gy}
                  stroke="#1e2530"
                  strokeWidth="1"
                />
              ))}

              {/* Y-axis labels */}
              <text x={PAD_L - 4} y={PAD_T + 4}              textAnchor="end" fill="#4b5563" fontSize="11">{yTopLabel}</text>
              <text x={PAD_L - 4} y={PAD_T + PLOT_H / 2 + 4} textAnchor="end" fill="#4b5563" fontSize="11">{yMidLabel}</text>
              <text x={PAD_L - 4} y={PAD_T + PLOT_H + 4}     textAnchor="end" fill="#4b5563" fontSize="11">{yBotLabel}</text>

              {/* X-axis labels */}
              <text x={PAD_L}          y={VB_H - 6} textAnchor="start" fill="#4b5563" fontSize="11">
                {formatDateShort(windowStart)}
              </text>
              <text x={PAD_L + PLOT_W} y={VB_H - 6} textAnchor="end"   fill="#4b5563" fontSize="11">
                Today
              </text>

              {/* Average line */}
              <line
                x1={PAD_L}          y1={avgY}
                x2={PAD_L + PLOT_W} y2={avgY}
                stroke="#e8a020"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Subtle glow line underneath for depth */}
              <line
                x1={PAD_L}          y1={avgY}
                x2={PAD_L + PLOT_W} y2={avgY}
                stroke="#e8a020"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.12"
              />
            </svg>
          </>
        )}
      </div>
    </div>
  );
}
