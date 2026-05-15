'use client';

import { useState } from 'react';
import {
  PITCH_TYPES,
  PITCH_TYPE_LABELS,
  VERIFICATION_TYPES,
  VERIFICATION_LABELS,
} from '@/lib/metrics';
import type {
  AthletePitch,
  PitchType,
  VerificationType,
} from '@/lib/metrics';
import VideoUpload from '@/components/VideoUpload';
import ProofUpload from '@/components/ProofUpload';

interface PitchEditModalProps {
  mode: 'create' | 'edit';
  pitch: AthletePitch | null;
  slot: number;
  allPitches: AthletePitch[];
  athleteClerkId: string;
  onClose: () => void;
  onSaved: () => void;
}

// ── Local constants ──────────────────────────────────────────────────────────

const SELECTABLE_VERIFICATION_TYPES: VerificationType[] =
  VERIFICATION_TYPES.filter(t => t !== 'coach_verified');

const MAX_SOURCE_LABEL_LEN = 200;

type NumericField = 'velocity' | 'spin_rate' | 'h_break' | 'v_break' | 'extension';

const NUMERIC_RANGES: Record<NumericField, [number, number]> = {
  velocity:  [0, 110],
  spin_rate: [0, 3500],
  h_break:   [-25, 25],
  v_break:   [-25, 25],
  extension: [4, 7],
};

// ── Shared style helpers ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize:   '0.78rem',
  color:      '#9ca3af',
  fontWeight: 500,
};

const errorMessageStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color:    '#f85149',
};

const helperStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color:    '#6b7280',
};

function inputStyle(hasError: boolean, disabled = false): React.CSSProperties {
  return {
    width:        '100%',
    background:   '#0d1117',
    border:       `1px solid ${hasError ? '#f85149' : '#1e2530'}`,
    padding:      '0.55rem 0.75rem',
    color:        '#f0f6fc',
    borderRadius: '0.4rem',
    fontSize:     '0.88rem',
    fontFamily:   'inherit',
    outline:      'none',
    opacity:      disabled ? 0.6 : 1,
    cursor:       disabled ? 'not-allowed' : 'auto',
  };
}

function fieldFocusBlur(hasError: boolean) {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (!hasError) e.currentTarget.style.borderColor = '#58a6ff';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = hasError ? '#f85149' : '#1e2530';
    },
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PitchEditModal({
  mode, pitch, slot, allPitches, athleteClerkId, onClose, onSaved,
}: PitchEditModalProps) {
  const isEdit = mode === 'edit';
  const isCoachVerifiedLocked = isEdit && pitch?.verification_type === 'coach_verified';

  // Form state
  const [pitchSlot, setPitchSlot]               = useState<number>(slot);
  const [pitchType, setPitchType]               = useState<PitchType>(pitch?.pitch_type ?? 'fastball_4seam');
  const [velocity, setVelocity]                 = useState<string>(pitch?.velocity  != null ? String(pitch.velocity)  : '');
  const [spinRate, setSpinRate]                 = useState<string>(pitch?.spin_rate != null ? String(pitch.spin_rate) : '');
  const [hBreak, setHBreak]                     = useState<string>(pitch?.h_break   != null ? String(pitch.h_break)   : '');
  const [vBreak, setVBreak]                     = useState<string>(pitch?.v_break   != null ? String(pitch.v_break)   : '');
  const [extension, setExtension]               = useState<string>(pitch?.extension != null ? String(pitch.extension) : '');
  const [verificationType, setVerificationType] = useState<VerificationType>(pitch?.verification_type ?? 'self_reported');
  const [sourceLabel, setSourceLabel]           = useState<string>(pitch?.source_label ?? '');
  const [videoUrl, setVideoUrl]                 = useState<string>(pitch?.video_url    ?? '');
  const [proofUrl, setProofUrl]                 = useState<string>(pitch?.proof_url    ?? '');
  const [saving, setSaving]                     = useState(false);
  const [errors, setErrors]                     = useState<Record<string, string>>({});
  const [apiError, setApiError]                 = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]       = useState(false);

  const takenSlots = new Set(
    allPitches.filter(p => p.id !== pitch?.id).map(p => p.pitch_slot),
  );

  // ── Validators ─────────────────────────────────────────────────────────────

  function validateNumeric(field: NumericField, raw: string): string | null {
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${field} must be a number.`;
    const [lo, hi] = NUMERIC_RANGES[field];
    if (n < lo || n > hi) return `${field} must be between ${lo} and ${hi}.`;
    return null;
  }

  function validatePitchSlot(n: number): string | null {
    if (!Number.isInteger(n) || n < 1 || n > 5) return 'Slot must be an integer 1–5.';
    if (takenSlots.has(n)) return `Slot ${n} is taken by another pitch.`;
    return null;
  }

  function setFieldError(name: string, error: string | null) {
    setErrors(prev => {
      const next = { ...prev };
      if (error) next[name] = error;
      else delete next[name];
      return next;
    });
  }

  function handleNumericChange(field: NumericField, setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setter(v);
      setFieldError(field, validateNumeric(field, v));
    };
  }

  function handleSlotChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const n = Number(e.target.value);
    setPitchSlot(n);
    setFieldError('pitch_slot', validatePitchSlot(n));
  }

  function handleSourceLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSourceLabel(v);
    setFieldError(
      'source_label',
      v.length > MAX_SOURCE_LABEL_LEN
        ? `source_label must be ≤ ${MAX_SOURCE_LABEL_LEN} chars.`
        : null,
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || hasErrors) return;
    void handleSave();
  }

  async function handleSave() {
    // Final validation sweep — gate against stale errors that never opened.
    const errs: Record<string, string> = {};
    const slotErr = validatePitchSlot(pitchSlot);
    if (slotErr) errs.pitch_slot = slotErr;
    for (const [name, val] of [
      ['velocity',  velocity ],
      ['spin_rate', spinRate ],
      ['h_break',   hBreak   ],
      ['v_break',   vBreak   ],
      ['extension', extension],
    ] as const) {
      const err = validateNumeric(name, val);
      if (err) errs[name] = err;
    }
    if (sourceLabel.length > MAX_SOURCE_LABEL_LEN) {
      errs.source_label = `source_label must be ≤ ${MAX_SOURCE_LABEL_LEN} chars.`;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setApiError(null);

    const body = {
      pitch_slot:        pitchSlot,
      pitch_type:        pitchType,
      velocity:          velocity  === '' ? null : Number(velocity),
      spin_rate:         spinRate  === '' ? null : Number(spinRate),
      h_break:           hBreak    === '' ? null : Number(hBreak),
      v_break:           vBreak    === '' ? null : Number(vBreak),
      extension:         extension === '' ? null : Number(extension),
      verification_type: verificationType,
      source_label:      sourceLabel === '' ? null : sourceLabel,
      video_url:         videoUrl    === '' ? null : videoUrl,
      proof_url:         proofUrl    === '' ? null : proofUrl,
    };

    const url    = isEdit && pitch ? `/api/athlete/pitches/${pitch.id}` : '/api/athlete/pitches';
    const method = isEdit && pitch ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setApiError(data.error ?? 'Failed to save pitch.');
    } catch {
      setApiError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pitch) return;
    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/athlete/pitches/${pitch.id}`, { method: 'DELETE' });
      if (res.ok) {
        onSaved();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setApiError(data.error ?? 'Failed to delete pitch.');
    } catch {
      setApiError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  // Source-label helper text
  let sourceLabelHelper: string;
  if (isCoachVerifiedLocked) {
    sourceLabelHelper = 'Locked. Only Diamond Verified coaches can change this.';
  } else if (verificationType.startsWith('third_party')) {
    sourceLabelHelper = "Recommended — e.g. 'Rapsodo Import 4/15/26'";
  } else {
    sourceLabelHelper = '(optional)';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(13,17,23,0.90)',
        zIndex:          110,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '1.5rem',
      }}
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
        style={{
          width:           '100%',
          maxWidth:        '520px',
          backgroundColor: '#111827',
          border:          '1px solid #1e2530',
          borderRadius:    '0.75rem',
          overflow:        'hidden',
          display:         'flex',
          flexDirection:   'column',
          maxHeight:       '90vh',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '1rem 1.25rem',
          borderBottom:   '1px solid #1e2530',
          flexShrink:     0,
        }}>
          <span style={{
            color:      '#f0f6fc',
            fontWeight: 700,
            fontSize:   '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            {isEdit ? 'Edit Pitch' : 'Add Pitch'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background:   'transparent',
              border:       'none',
              color:        '#6b7280',
              fontSize:     '1.25rem',
              lineHeight:   1,
              cursor:       'pointer',
              padding:      '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              transition:   'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding:       '1.25rem',
          overflowY:     'auto',
          maxHeight:     '60vh',
          display:       'flex',
          flexDirection: 'column',
          gap:           '1rem',
        }}>
          {apiError && (
            <div style={{
              background:   'rgba(248,81,73,0.1)',
              border:       '1px solid rgba(248,81,73,0.4)',
              borderRadius: '0.4rem',
              padding:      '0.6rem 0.75rem',
              fontSize:     '0.82rem',
              color:        '#f85149',
            }}>
              {apiError}
            </div>
          )}

          {/* Slot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Slot</label>
            <select
              value={pitchSlot}
              onChange={handleSlotChange}
              style={inputStyle(!!errors.pitch_slot)}
              {...fieldFocusBlur(!!errors.pitch_slot)}
            >
              {[1, 2, 3, 4, 5].map(n => {
                const taken = takenSlots.has(n);
                return (
                  <option key={n} value={n} disabled={taken}>
                    Slot {n}{taken ? ' (taken)' : ''}
                  </option>
                );
              })}
            </select>
            {errors.pitch_slot && <span style={errorMessageStyle}>{errors.pitch_slot}</span>}
          </div>

          {/* Pitch Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Pitch Type</label>
            <select
              value={pitchType}
              onChange={e => setPitchType(e.target.value as PitchType)}
              style={inputStyle(false)}
              {...fieldFocusBlur(false)}
            >
              {PITCH_TYPES.map(t => (
                <option key={t} value={t}>{PITCH_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Telemetry — 2-column grid */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            gap:                 '0.75rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Velocity (mph)</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={110}
                placeholder="e.g. 88.5"
                value={velocity}
                onChange={handleNumericChange('velocity', setVelocity)}
                style={inputStyle(!!errors.velocity)}
                {...fieldFocusBlur(!!errors.velocity)}
              />
              {errors.velocity && <span style={errorMessageStyle}>{errors.velocity}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Spin Rate (rpm)</label>
              <input
                type="number"
                step={1}
                min={0}
                max={3500}
                placeholder="e.g. 2400"
                value={spinRate}
                onChange={handleNumericChange('spin_rate', setSpinRate)}
                style={inputStyle(!!errors.spin_rate)}
                {...fieldFocusBlur(!!errors.spin_rate)}
              />
              {errors.spin_rate && <span style={errorMessageStyle}>{errors.spin_rate}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Horizontal Break (in)</label>
              <input
                type="number"
                step={0.1}
                min={-25}
                max={25}
                placeholder="e.g. 12.3 or -5"
                value={hBreak}
                onChange={handleNumericChange('h_break', setHBreak)}
                style={inputStyle(!!errors.h_break)}
                {...fieldFocusBlur(!!errors.h_break)}
              />
              {errors.h_break && <span style={errorMessageStyle}>{errors.h_break}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Vertical Break (in)</label>
              <input
                type="number"
                step={0.1}
                min={-25}
                max={25}
                placeholder="e.g. -8.5"
                value={vBreak}
                onChange={handleNumericChange('v_break', setVBreak)}
                style={inputStyle(!!errors.v_break)}
                {...fieldFocusBlur(!!errors.v_break)}
              />
              {errors.v_break && <span style={errorMessageStyle}>{errors.v_break}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Extension (ft)</label>
              <input
                type="number"
                step={0.1}
                min={4}
                max={7}
                placeholder="e.g. 6.2"
                value={extension}
                onChange={handleNumericChange('extension', setExtension)}
                style={inputStyle(!!errors.extension)}
                {...fieldFocusBlur(!!errors.extension)}
              />
              {errors.extension && <span style={errorMessageStyle}>{errors.extension}</span>}
            </div>
          </div>

          {/* Verification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Verification</label>
            {isCoachVerifiedLocked ? (
              <>
                <div
                  style={{
                    ...inputStyle(false, true),
                    display:    'flex',
                    alignItems: 'center',
                    color:      '#e8a020',
                    fontWeight: 600,
                  }}
                >
                  {VERIFICATION_LABELS.coach_verified.label}
                </div>
                <span style={{ ...helperStyle, fontStyle: 'italic' }}>
                  Only Diamond Verified coaches can change this.
                </span>
              </>
            ) : (
              <select
                value={verificationType}
                onChange={e => setVerificationType(e.target.value as VerificationType)}
                style={inputStyle(false)}
                {...fieldFocusBlur(false)}
              >
                {SELECTABLE_VERIFICATION_TYPES.map(t => (
                  <option key={t} value={t}>{VERIFICATION_LABELS[t].label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Proof — only when third-party verification is selected. Switching away
              from third_party_* hides the block but preserves the stored proof_url
              in DB; switching back surfaces the previously attached proof. */}
          {verificationType.startsWith('third_party_') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Proof</label>

              {proofUrl ? (
                <div
                  key={proofUrl || 'empty'}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    background:     'rgba(52, 211, 153, 0.08)',
                    border:         '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius:   '0.4rem',
                    padding:        '0.55rem 0.75rem',
                    gap:            '0.5rem',
                    flexWrap:       'wrap',
                  }}
                >
                  <span style={{ color: '#34d399', fontSize: '0.82rem', fontWeight: 500 }}>
                    &#10003; Proof attached
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color:          '#58a6ff',
                        fontSize:       '0.82rem',
                        textDecoration: 'none',
                        padding:        '0.25rem 0.5rem',
                        borderRadius:   '0.3rem',
                      }}
                    >
                      View file &#x2197;
                    </a>
                    <button
                      type="button"
                      onClick={() => setProofUrl('')}
                      style={{
                        background:   'transparent',
                        border:       'none',
                        color:        '#9ca3af',
                        cursor:       'pointer',
                        fontSize:     '0.82rem',
                        padding:      '0.25rem 0.5rem',
                        borderRadius: '0.3rem',
                      }}
                      aria-label="Remove proof"
                    >
                      &#x2715; Remove
                    </button>
                  </div>
                </div>
              ) : (
                <ProofUpload
                  onUploadComplete={url => setProofUrl(url)}
                  onError={msg => setApiError(msg)}
                />
              )}

              <span style={helperStyle}>
                Evidence for third-party verification &mdash; e.g. Rapsodo PDF, HitTrax screenshot. Optional but recommended.
              </span>
            </div>
          )}

          {/* Source Label */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Source Label</label>
            <input
              type="text"
              maxLength={MAX_SOURCE_LABEL_LEN}
              placeholder="e.g. Pocket Radar"
              value={sourceLabel}
              disabled={isCoachVerifiedLocked}
              onChange={handleSourceLabelChange}
              style={inputStyle(!!errors.source_label, isCoachVerifiedLocked)}
              {...fieldFocusBlur(!!errors.source_label)}
            />
            {errors.source_label && <span style={errorMessageStyle}>{errors.source_label}</span>}
            <span style={helperStyle}>{sourceLabelHelper}</span>
          </div>

          {/* Video — TUS upload to Bunny Stream, returns iframe embed URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>Video</label>

            {videoUrl && (
              <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                background:     'rgba(52, 211, 153, 0.08)',
                border:         '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius:   '0.4rem',
                padding:        '0.55rem 0.75rem',
              }}>
                <span style={{ color: '#34d399', fontSize: '0.82rem', fontWeight: 500 }}>
                  &#10003; Video attached
                </span>
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  style={{
                    background:   'transparent',
                    border:       'none',
                    color:        '#9ca3af',
                    cursor:       'pointer',
                    fontSize:     '0.82rem',
                    padding:      '0.25rem 0.5rem',
                    borderRadius: '0.3rem',
                  }}
                  aria-label="Remove video"
                >
                  &#x2715; Remove
                </button>
              </div>
            )}

            <VideoUpload
              key={videoUrl || 'empty'}
              athleteClerkId={athleteClerkId}
              uploadType="pitch"
              onUploadComplete={url => setVideoUrl(url)}
              onError={msg => setApiError(msg)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:        '0.875rem 1.25rem',
          borderTop:      '1px solid #1e2530',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            '0.75rem',
          flexShrink:     0,
        }}>
          {/* Left side — Delete (edit mode only) */}
          <div>
            {isEdit && pitch && !deleteConfirm && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                disabled={saving}
                style={{
                  background:   'transparent',
                  border:       '1px solid rgba(248,81,73,0.4)',
                  color:        '#f85149',
                  padding:      '0.4rem 0.875rem',
                  borderRadius: '0.4rem',
                  fontSize:     '0.82rem',
                  fontWeight:   500,
                  cursor:       saving ? 'not-allowed' : 'pointer',
                  opacity:      saving ? 0.6 : 1,
                }}
              >
                Delete Pitch
              </button>
            )}
            {isEdit && pitch && deleteConfirm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#f85149', fontSize: '0.82rem' }}>Delete this pitch?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    background:   '#f85149',
                    border:       '1px solid #f85149',
                    color:        '#ffffff',
                    padding:      '0.35rem 0.75rem',
                    borderRadius: '0.4rem',
                    fontSize:     '0.78rem',
                    fontWeight:   600,
                    cursor:       saving ? 'not-allowed' : 'pointer',
                    opacity:      saving ? 0.6 : 1,
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={saving}
                  style={{
                    background:   'transparent',
                    border:       '1px solid #4b5563',
                    color:        '#9ca3af',
                    padding:      '0.35rem 0.75rem',
                    borderRadius: '0.4rem',
                    fontSize:     '0.78rem',
                    fontWeight:   500,
                    cursor:       saving ? 'not-allowed' : 'pointer',
                    opacity:      saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Right side — Cancel + Save */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background:   'transparent',
                border:       '1px solid #4b5563',
                color:        '#9ca3af',
                padding:      '0.45rem 1rem',
                borderRadius: '0.4rem',
                fontSize:     '0.82rem',
                fontWeight:   500,
                cursor:       saving ? 'not-allowed' : 'pointer',
                opacity:      saving ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || hasErrors}
              style={{
                background:   saving || hasErrors ? '#374151' : '#e8a020',
                border:       'none',
                color:        saving || hasErrors ? '#6b7280' : '#000000',
                padding:      '0.45rem 1.1rem',
                borderRadius: '0.4rem',
                fontSize:     '0.82rem',
                fontWeight:   700,
                cursor:       saving || hasErrors ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
