'use client';

import type { AthletePitch } from '@/lib/metrics';
import PitchCard from './PitchCard';

const MAX_PITCH_SLOTS = 5;

interface PitchArsenalProps {
  pitches: AthletePitch[];
  readOnly: boolean;
}

export default function PitchArsenal({ pitches, readOnly }: PitchArsenalProps) {
  const sorted = [...pitches].sort((a, b) => a.pitch_slot - b.pitch_slot);

  // ── Empty + readOnly: muted "no pitches" message ───────────────────────────
  if (sorted.length === 0 && readOnly) {
    return (
      <div
        style={{
          background:    '#0f1620',
          border:        '1px solid #1a222e',
          borderRadius:  '0.75rem',
          padding:       '2rem 1.5rem',
          textAlign:     'center',
          color:         '#6b7280',
          fontSize:      '0.88rem',
          fontStyle:     'italic',
          lineHeight:    1.6,
        }}
      >
        This athlete has not recorded any pitches yet.
      </div>
    );
  }

  // ── Empty + editable: prominent first-pitch CTA ────────────────────────────
  if (sorted.length === 0 && !readOnly) {
    return (
      <div
        style={{
          background:    '#111827',
          border:        '1px dashed rgba(232,160,32,0.4)',
          borderRadius:  '0.75rem',
          padding:       '2rem 1.5rem',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '0.75rem',
          textAlign:     'center',
        }}
      >
        <p style={{ color: '#9ca3af', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, maxWidth: '380px' }}>
          Add up to 5 pitches with velocity, spin, break, and extension.
        </p>
        <button
          type="button"
          onClick={() => console.log('Add first pitch')}
          style={{
            background:   '#e8a020',
            color:        '#000',
            border:       'none',
            borderRadius: '0.5rem',
            padding:      '0.6rem 1.5rem',
            fontSize:     '0.88rem',
            fontWeight:   700,
            cursor:       'pointer',
            transition:   'background 0.15s',
            marginTop:    '0.25rem',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#f0a82a';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#e8a020';
          }}
        >
          Add your first pitch
        </button>
      </div>
    );
  }

  // ── Non-empty grid ─────────────────────────────────────────────────────────
  const showAddSlot = !readOnly && sorted.length < MAX_PITCH_SLOTS;
  const nextSlot = sorted.length + 1;

  return (
    <div
      style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap:                 '1rem',
      }}
    >
      {sorted.map(pitch => (
        <PitchCard key={pitch.id} pitch={pitch} readOnly={readOnly} />
      ))}

      {showAddSlot && (
        <button
          type="button"
          onClick={() => console.log('Add pitch in slot', nextSlot)}
          style={{
            background:    'transparent',
            border:        '1px dashed #374151',
            borderRadius:  '0.75rem',
            padding:       '1.25rem',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            justifyContent:'center',
            gap:           '0.4rem',
            minHeight:     '180px',
            cursor:        'pointer',
            color:         '#9ca3af',
            fontFamily:    'inherit',
            transition:    'border-color 0.15s, background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.5)';
            (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(232,160,32,0.04)';
            (e.currentTarget as HTMLButtonElement).style.color       = '#e8a020';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151';
            (e.currentTarget as HTMLButtonElement).style.background  = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color       = '#9ca3af';
          }}
        >
          <span style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 300 }}>+</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Add a pitch</span>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
            Slot {nextSlot} of {MAX_PITCH_SLOTS} available
          </span>
        </button>
      )}
    </div>
  );
}
