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
}

export default function PitchArsenal({ pitches, readOnly, athleteClerkId, pitchHistory, showProof = false }: PitchArsenalProps) {
  const router = useRouter();
  const sorted = [...pitches].sort((a, b) => a.pitch_slot - b.pitch_slot);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [editingPitch, setEditingPitch] = useState<AthletePitch | null>(null);
  const [createSlot, setCreateSlot]     = useState<number | null>(null);
  const [watchPitch, setWatchPitch]     = useState<AthletePitch | null>(null);
  const [historyPitch, setHistoryPitch] = useState<AthletePitch | null>(null);

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
        {sorted.map(pitch => (
          <PitchCard
            key={pitch.id}
            pitch={pitch}
            readOnly={readOnly}
            onEdit={handleEdit}
            onWatch={handleWatch}
            pitchHistory={pitchHistory}
            onHistory={handleHistory}
            showProof={showProof}
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
