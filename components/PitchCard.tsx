'use client';

import { PITCH_TYPE_LABELS } from '@/lib/metrics';
import type { AthletePitch, VerificationType } from '@/lib/metrics';

interface PitchCardProps {
  pitch: AthletePitch;
  readOnly: boolean;
  onEdit?: (pitch: AthletePitch) => void;
  onWatch?: (pitch: AthletePitch) => void;
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

export default function PitchCard({ pitch, readOnly, onEdit, onWatch }: PitchCardProps) {
  const pitchLabel = PITCH_TYPE_LABELS[pitch.pitch_type] ?? pitch.pitch_type;

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

      {/* Footer — Watch / Edit buttons */}
      {(pitch.video_url || !readOnly) && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {pitch.video_url && (
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
      )}
    </div>
  );
}
