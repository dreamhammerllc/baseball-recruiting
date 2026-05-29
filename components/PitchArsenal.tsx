'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PITCH_TYPE_LABELS,
  PITCH_TYPE_TO_METRIC_KEY,
  getHistoryForPitchType,
} from '@/lib/metrics';
import type { AthleteMetric, AthletePitch } from '@/lib/metrics';
import PitchCard from './PitchCard';
import PitchEditModal from './PitchEditModal';
import WatchVideoModal from '@/components/WatchVideoModal';
import MetricsGraph from '@/components/MetricsGraph';

const MAX_PITCH_SLOTS = 5;

interface PitchArsenalProps {
  pitches: AthletePitch[];
  readOnly: boolean;
  athleteClerkId: string;
  pitchHistory?: AthleteMetric[];
  showProof?: boolean;
  /** Phase 2c-iv: athlete's coach-verified athlete_metrics rows (every coach-
   *  verified entry, NOT gated on is_personal_best). The PB filter is wrong
   *  for this surface — when a third-party row at the same value happens to
   *  hold the PB slot, the coach row gets is_personal_best=false but it's
   *  still the verification the visitor wants to see attributed. Optional —
   *  when absent, no attribution renders on any pitch card (graceful no-op). */
  coachVerifiedMetrics?: AthleteMetric[];
}

// Match epsilon for value-matching pitch.velocity against an athlete_metrics
// row's value. Tight enough to avoid attributing across different real
// readings, loose enough to absorb FP / numeric-precision noise (e.g.,
// 92.10 vs 92.1 or trailing-zero serialization differences).
const VALUE_MATCH_EPSILON = 0.05;

// Q4 rule: attribution renders on the pitch slot whose velocity matches a
// coach-verified row's value (within VALUE_MATCH_EPSILON) for its mapped
// metric_key. Handles fastball faster-of-the-two implicitly (only the higher
// slot's velocity matches the coach-verified value the write-through wrote
// in) and trivially for single-slot pitch types (slider/curveball/changeup).
function resolveCoachPb(
  pitch: AthletePitch,
  coachVerifiedMetrics: AthleteMetric[] | undefined,
): AthleteMetric | null {
  if (!coachVerifiedMetrics || pitch.velocity == null) return null;
  const mappedKey = PITCH_TYPE_TO_METRIC_KEY[pitch.pitch_type];
  if (!mappedKey) return null;
  const pitchVel = Number(pitch.velocity);
  if (!Number.isFinite(pitchVel)) return null;
  return coachVerifiedMetrics.find(
    m =>
      m.metric_key === mappedKey &&
      m.verification_type === 'coach_verified' &&
      Math.abs(Number(m.value) - pitchVel) < VALUE_MATCH_EPSILON,
  ) ?? null;
}

export default function PitchArsenal({ pitches, readOnly, athleteClerkId, pitchHistory, showProof = false, coachVerifiedMetrics }: PitchArsenalProps) {
  const router = useRouter();
  const sorted = [...pitches].sort((a, b) => a.pitch_slot - b.pitch_slot);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [editingPitch, setEditingPitch] = useState<AthletePitch | null>(null);
  const [createSlot, setCreateSlot]     = useState<number | null>(null);
  const [watchPitch, setWatchPitch]     = useState<AthletePitch | null>(null);
  const [historyPitch, setHistoryPitch] = useState<AthletePitch | null>(null);
  const [moveError, setMoveError]       = useState<string | null>(null);
  const [movingId, setMovingId]         = useState<string | null>(null);

  function handleAdd(slot: number) {
    setModalMode('create');
    setCreateSlot(slot);
    setEditingPitch(null);
  }

  function handleEdit(pitch: AthletePitch) {
    setModalMode('edit');
    setEditingPitch(pitch);
    setCreateSlot(null);
  }

  function handleClose() {
    setModalMode(null);
    setEditingPitch(null);
    setCreateSlot(null);
  }

  function handleSaved() {
    router.refresh();
    handleClose();
  }

  function handleWatch(pitch: AthletePitch) {
    setWatchPitch(pitch);
  }

  function handleCloseWatch() {
    setWatchPitch(null);
  }

  function handleHistory(pitch: AthletePitch) {
    setHistoryPitch(pitch);
  }

  function handleCloseHistory() {
    setHistoryPitch(null);
  }

  async function handleMove(pitch: AthletePitch, direction: 'up' | 'down') {
    if (movingId) return; // ignore rapid re-clicks while a move is in flight
    setMovingId(pitch.id);
    setMoveError(null);
    try {
      const res = await fetch(`/api/athlete/pitches/${pitch.id}/move`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ direction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setMoveError(data?.error ?? 'Failed to move pitch.');
        return;
      }
      router.refresh();
    } catch {
      setMoveError('Failed to move pitch.');
    } finally {
      setMovingId(null);
    }
  }

  // ── Body branches — pick exactly one based on emptiness + readOnly ────────
  let body: React.ReactNode;

  if (sorted.length === 0 && readOnly) {
    body = (
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
  } else if (sorted.length === 0 && !readOnly) {
    body = (
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
          onClick={() => handleAdd(1)}
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
  } else {
    const showAddSlot = !readOnly && sorted.length < MAX_PITCH_SLOTS;
    const usedSlots   = new Set(sorted.map(p => p.pitch_slot));
    const nextSlot    = [1, 2, 3, 4, 5].find(n => !usedSlots.has(n)) ?? 1;

    body = (
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap:                 '1rem',
        }}
      >
        {sorted.map((pitch, idx) => (
          <PitchCard
            key={pitch.id}
            pitch={pitch}
            readOnly={readOnly}
            onEdit={handleEdit}
            onWatch={handleWatch}
            pitchHistory={pitchHistory}
            onHistory={handleHistory}
            showProof={showProof}
            canMoveUp={idx > 0}
            canMoveDown={idx < sorted.length - 1}
            onMove={readOnly ? undefined : handleMove}
            coachPb={resolveCoachPb(pitch, coachVerifiedMetrics)}
          />
        ))}

        {showAddSlot && (
          <button
            type="button"
            onClick={() => handleAdd(nextSlot)}
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

  return (
    <>
      {moveError && (
        <div
          style={{
            background:   'rgba(248,81,73,0.08)',
            border:       '1px solid rgba(248,81,73,0.35)',
            color:        '#f85149',
            borderRadius: '0.5rem',
            padding:      '0.6rem 0.9rem',
            fontSize:     '0.8rem',
            marginBottom: '0.75rem',
          }}
        >
          {moveError}
        </div>
      )}
      {body}
      {modalMode !== null && (
        <PitchEditModal
          mode={modalMode}
          pitch={editingPitch}
          slot={modalMode === 'create' ? (createSlot ?? 1) : (editingPitch?.pitch_slot ?? 1)}
          allPitches={pitches}
          athleteClerkId={athleteClerkId}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}

      {watchPitch && (
        <WatchVideoModal
          title={PITCH_TYPE_LABELS[watchPitch.pitch_type]}
          videoUrl={watchPitch.video_url}
          onClose={handleCloseWatch}
        />
      )}

      {historyPitch && pitchHistory && (() => {
        const mappedKey = PITCH_TYPE_TO_METRIC_KEY[historyPitch.pitch_type];
        if (!mappedKey) return null;
        const entries = getHistoryForPitchType(pitchHistory, historyPitch.pitch_type);
        return (
          <MetricsGraph
            metricKey={mappedKey}
            entries={entries}
            onClose={handleCloseHistory}
          />
        );
      })()}
    </>
  );
}
