'use client';

import { PITCH_TYPE_LABELS, PITCH_TYPE_TO_METRIC_KEY, getHistoryForPitchType } from '@/lib/metrics';
import type { AthleteMetric, AthletePitch, VerificationType } from '@/lib/metrics';
import VerifiedAttribution from './VerifiedAttribution';

interface PitchCardProps {
  pitch: AthletePitch;
  readOnly: boolean;
  onEdit?: (pitch: AthletePitch) => void;
  onWatch?: (pitch: AthletePitch) => void;
  pitchHistory?: AthleteMetric[];
  onHistory?: (pitch: AthletePitch) => void;
  showProof?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (pitch: AthletePitch, direction: 'up' | 'down') => void;
  /** Phase 2c-iv: coach-verified PB row for this pitch's mapped metric_key,
   *  resolved by the parent (PitchArsenal) only when the pitch's velocity
   *  matches the PB value (faster-of-the-two rule for fastballs; trivial
   *  match for slider/curveball/changeup). When non-null, the pitch card
   *  renders an inline VerifiedAttribution block in its footer. */
  coachPb?: AthleteMetric | null;
}

// Fallback label when source_label is null. Humanizes the verification_type.
const VERIFICATION_FALLBACK_LABELS: Record<VerificationType, string> = {
  coach_verified:           'Coach Verified',
  third_party_hittrax:      'HitTrax',
  third_party_rapsodo:      'Rapsodo',
  third_party_blast_motion: 'Blast Motion',
  third_party_perfect_game: 'Perfect Game',
  third_party_trackman:     'Trackman',
  self_reported:            'Self Reported',
};

function getBadgeColor(verificationType: string): string {
  if (verificationType === 'coach_verified') return '#e8a020';
  if (verificationType.startsWith('third_party')) return '#58a6ff';
  return '#6b7280';
}

function getBadgeRgb(verificationType: string): string {
  if (verificationType === 'coach_verified') return '232,160,32';
  if (verificationType.startsWith('third_party')) return '88,166,255';
  return '107,114,128';
}

type TelemetryField = {
  label: string;
  value: number | null;
  unit:  string;
};

export default function PitchCard({ pitch, readOnly, onEdit, onWatch, pitchHistory, onHistory, showProof = false, canMoveUp = false, canMoveDown = false, onMove, coachPb = null }: PitchCardProps) {
  const pitchLabel = PITCH_TYPE_LABELS[pitch.pitch_type] ?? pitch.pitch_type;

  // History gate — only render the button when a mapped metric_key exists for this
  // pitch type AND the parent supplied non-empty history AND an onHistory callback.
  const historyForThisPitch = pitchHistory ? getHistoryForPitchType(pitchHistory, pitch.pitch_type) : [];
  const showHistoryButton   = historyForThisPitch.length > 0 && !!onHistory;

  const badgeColor = getBadgeColor(pitch.verification_type);
  const badgeRgb   = getBadgeRgb(pitch.verification_type);
  const badgeLabel =
    pitch.source_label ??
    VERIFICATION_FALLBACK_LABELS[pitch.verification_type as VerificationType] ??
    pitch.verification_type;

  const telemetry: TelemetryField[] = [
    { label: 'Velocity',  value: pitch.velocity,  unit: 'mph' },
    { label: 'Spin Rate', value: pitch.spin_rate, unit: 'rpm' },
    { label: 'H Break',   value: pitch.h_break,   unit: 'in'  },
    { label: 'V Break',   value: pitch.v_break,   unit: 'in'  },
    { label: 'Extension', value: pitch.extension, unit: 'ft'  },
  ];

  const filledCount = telemetry.filter(t => t.value !== null).length;
  const isIncomplete = filledCount < telemetry.length;

  return (
    <div
      style={{
        background:    isIncomplete ? '#0f1620' : '#111827',
        border:        `1px solid ${isIncomplete ? '#1a222e' : '#1e2530'}`,
        borderRadius:  '0.75rem',
        padding:       '1.25rem',
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.75rem',
        position:      'relative',
        opacity:       isIncomplete ? 0.92 : 1,
      }}
    >
      {/* Header row: pitch type label + verification badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span style={{ color: '#f0f6fc', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: '0.95rem' }}>
          {pitchLabel}
        </span>

        {badgeLabel && (
          <span
            title={badgeLabel}
            style={{
              background:   `rgba(${badgeRgb}, 0.12)`,
              border:       `1px solid rgba(${badgeRgb}, 0.3)`,
              color:        badgeColor,
              borderRadius: '9999px',
              padding:      '0.15rem 0.6rem',
              fontSize:     '0.7rem',
              fontWeight:   600,
              whiteSpace:   'nowrap',
              cursor:       'default',
              maxWidth:     '60%',
              minWidth:     0,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Incomplete status pill */}
      {isIncomplete && (
        <div>
          <span
            style={{
              display:      'inline-block',
              background:   'rgba(107,114,128,0.10)',
              border:       '1px solid rgba(107,114,128,0.25)',
              color:        '#9ca3af',
              borderRadius: '9999px',
              padding:      '0.15rem 0.6rem',
              fontSize:     '0.7rem',
              fontWeight:   500,
              whiteSpace:   'nowrap',
            }}
          >
            Incomplete &middot; {filledCount} of {telemetry.length}
          </span>
        </div>
      )}

      {/* Body — 5 telemetry rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {telemetry.map(row => (
          <div
            key={row.label}
            style={{
              display:        'flex',
              alignItems:     'baseline',
              justifyContent: 'space-between',
              gap:            '0.75rem',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: '0.78rem', fontWeight: 500 }}>
              {row.label}
            </span>
            {row.value !== null ? (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                <span style={{ color: '#f0f6fc', fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>
                  {row.value}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>
                  {row.unit}
                </span>
              </span>
            ) : (
              <span style={{ color: '#4b5563', fontStyle: 'italic', fontSize: '0.82rem' }}>
                Not measured
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Coach verification attribution (Phase 2c-iv). Renders only when the
          parent resolved a coach-verified PB row matching this slot's value. */}
      {coachPb && <VerifiedAttribution pb={coachPb} />}

      {/* Footer — History / Watch / View Proof / Edit buttons.
          When VerifiedAttribution rendered its own "Watch proof" button (i.e.
          coachPb exists and carries a video), suppress the footer "Watch"
          button so we don't double up on the same clip. */}
      {(() => {
        const showFooterWatch = !!pitch.video_url && !(coachPb && coachPb.video_url);
        const showFooter =
          showHistoryButton || showFooterWatch || (showProof && pitch.proof_url) || !readOnly;
        if (!showFooter) return null;
        return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {!readOnly && onMove && (
            <div style={{ display: 'flex', gap: '0.35rem', marginRight: 'auto' }}>
              <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp}
                onClick={() => { if (canMoveUp && onMove) onMove(pitch, 'up'); }}
                style={{
                  background:   'transparent',
                  border:       `1px solid ${canMoveUp ? '#4b5563' : '#374151'}`,
                  color:        canMoveUp ? '#9ca3af' : '#4b5563',
                  borderRadius: '0.4rem',
                  padding:      '0.3rem 0.5rem',
                  cursor:       canMoveUp ? 'pointer' : 'default',
                  display:      'inline-flex',
                  alignItems:   'center',
                  transition:   'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={canMoveUp ? (e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                  (e.currentTarget as HTMLButtonElement).style.color       = '#f0f6fc';
                } : undefined}
                onMouseLeave={canMoveUp ? (e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
                  (e.currentTarget as HTMLButtonElement).style.color       = '#9ca3af';
                } : undefined}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown}
                onClick={() => { if (canMoveDown && onMove) onMove(pitch, 'down'); }}
                style={{
                  background:   'transparent',
                  border:       `1px solid ${canMoveDown ? '#4b5563' : '#374151'}`,
                  color:        canMoveDown ? '#9ca3af' : '#4b5563',
                  borderRadius: '0.4rem',
                  padding:      '0.3rem 0.5rem',
                  cursor:       canMoveDown ? 'pointer' : 'default',
                  display:      'inline-flex',
                  alignItems:   'center',
                  transition:   'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={canMoveDown ? (e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
                  (e.currentTarget as HTMLButtonElement).style.color       = '#f0f6fc';
                } : undefined}
                onMouseLeave={canMoveDown ? (e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
                  (e.currentTarget as HTMLButtonElement).style.color       = '#9ca3af';
                } : undefined}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          )}

          {showHistoryButton && (
            <button
              type="button"
              onClick={() => onHistory!(pitch)}
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
              History
            </button>
          )}

          {showFooterWatch && (
            <button
              type="button"
              onClick={() => { if (onWatch) onWatch(pitch); }}
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

          {showProof && pitch.proof_url && (
            <button
              type="button"
              onClick={() => {
                if (pitch.proof_url) {
                  window.open(pitch.proof_url, '_blank', 'noopener,noreferrer');
                }
              }}
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
                display:      'inline-flex',
                alignItems:   'center',
                gap:          '0.35rem',
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              View Proof
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                if (onEdit) onEdit(pitch);
                else console.log('Edit pitch:', pitch.id);
              }}
              style={{
                background:   'transparent',
                border:       '1px solid #4b5563',
                color:        '#9ca3af',
                borderRadius: '0.4rem',
                padding:      '0.3rem 0.75rem',
                fontSize:     '0.78rem',
                cursor:       'pointer',
                fontWeight:   500,
                transition:   'border-color 0.15s, color 0.15s',
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
              Edit
            </button>
          )}
        </div>
        );
      })()}
    </div>
  );
}
