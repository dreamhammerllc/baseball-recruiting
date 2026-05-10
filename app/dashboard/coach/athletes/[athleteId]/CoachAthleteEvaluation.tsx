'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/time';

interface Note {
  id:        string;
  athleteId: string;
  rating:    number | null;
  notes:     string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  athleteId: string;
}

const colors = {
  bg:          '#0d1117',
  surface:     '#111827',
  border:      '#1e2530',
  borderHover: '#30363d',
  gold:        '#e8a020',
  goldFg:      '#0a0e14',
  text:        '#f0f6fc',
  muted:       '#6b7280',
  error:       '#f87171',
  amber:       '#f59e0b',
};
const mono: React.CSSProperties = { fontFamily: 'monospace' };

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAX_NOTES = 4000;
const COUNTER_AMBER_AT = 3800;

export default function CoachAthleteEvaluation({ athleteId }: Props) {
  // ── Server state ─────────────────────────────────────────────────────────
  const [note,    setNote]    = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Form state ───────────────────────────────────────────────────────────
  const [rating,        setRating]        = useState<number | null>(null);
  const [notesText,     setNotesText]     = useState('');
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [savedToast,    setSavedToast]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const trimmedNotes = notesText.trim();
  const submitNotes  = trimmedNotes === '' ? null : trimmedNotes;
  const hasInput     = rating !== null || submitNotes !== null;

  const isDirty = note
    ? rating !== note.rating || submitNotes !== (note.notes ?? null)
    : hasInput;

  const canSave = isDirty && hasInput && !saving && !deleting;

  // ── Load evaluation on mount / athleteId change ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/coach/notes?athleteId=${encodeURIComponent(athleteId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error ?? 'Failed to load evaluation.');
          setLoading(false);
          return;
        }

        const n = (data.note ?? null) as Note | null;
        setNote(n);
        setRating(n?.rating ?? null);
        setNotesText(n?.notes ?? '');
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load evaluation.');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [athleteId]);

  // Auto-fade the "Saved." toast.
  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(false), 2000);
    return () => clearTimeout(t);
  }, [savedToast]);

  const clearError = useCallback(() => {
    setError(prev => (prev ? null : prev));
  }, []);

  function handleRatingClick(value: number) {
    if (saving || deleting) return;
    clearError();
    setRating(prev => (prev === value ? null : value));
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    clearError();
    setNotesText(e.target.value);
  }

  async function handleSave() {
    if (rating === null && submitNotes === null) {
      setError('Add a rating, notes, or both.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/coach/notes', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ athleteId, rating, notes: submitNotes }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Failed to save evaluation.');
        return;
      }

      const n = data.note as Note;
      setNote(n);
      setRating(n.rating);
      setNotesText(n.notes ?? '');
      setSavedToast(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save evaluation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/notes?athleteId=${encodeURIComponent(athleteId)}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Failed to delete evaluation.');
        return;
      }

      setNote(null);
      setRating(null);
      setNotesText('');
      setConfirmDelete(false);
      setSavedToast(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete evaluation.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background:   colors.surface,
    border:       `1px solid ${colors.border}`,
    borderRadius: '0.75rem',
    padding:      '1.25rem',
  };

  function ratingButtonStyle(value: number): React.CSSProperties {
    const selected = rating === value;
    const hovered  = hoveredRating === value && !selected;
    const disabled = saving || deleting;

    return {
      ...mono,
      width:       '40px',
      height:      '40px',
      borderRadius: '0.4rem',
      border: `1px solid ${selected ? colors.gold : hovered ? colors.gold : colors.borderHover}`,
      background:  selected ? colors.gold : 'transparent',
      color:       selected ? colors.goldFg : colors.text,
      fontSize:    '0.85rem',
      fontWeight:  selected ? 700 : 500,
      cursor:      disabled ? 'wait' : 'pointer',
      boxShadow:   selected ? '0 1px 3px rgba(232,160,32,0.45)' : 'none',
      opacity:     disabled ? 0.7 : 1,
      transition:  'border-color 120ms, background 120ms, box-shadow 120ms',
      padding:     0,
    };
  }

  const counterColor =
    notesText.length >= MAX_NOTES        ? colors.error :
    notesText.length >= COUNTER_AMBER_AT ? colors.amber :
    colors.muted;

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={cardStyle} aria-busy="true">
        <Header note={null} />
        <p style={{ color: colors.muted, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
          Loading evaluation…
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Header note={note} />

      {/* ── Rating ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '0.75rem' }}>
        <div
          style={{
            display:        'flex',
            alignItems:     'baseline',
            justifyContent: 'space-between',
            gap:            '0.75rem',
            marginBottom:   '0.5rem',
          }}
        >
          <span
            id="coach-eval-rating-label"
            style={{ ...mono, color: colors.muted, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            Rating
          </span>
          <span style={{ ...mono, color: colors.muted, fontSize: '0.68rem', opacity: 0.75 }}>
            Click again to clear.
          </span>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="coach-eval-rating-label"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}
        >
          {RATINGS.map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`Rating ${n} of 10${rating === n ? ', selected. Click again to clear.' : ''}`}
              disabled={saving || deleting}
              onMouseEnter={() => setHoveredRating(n)}
              onMouseLeave={() => setHoveredRating(curr => (curr === n ? null : curr))}
              onClick={() => handleRatingClick(n)}
              style={ratingButtonStyle(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '1.25rem' }}>
        <label
          htmlFor="coach-eval-notes"
          style={{ ...mono, color: colors.muted, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}
        >
          Notes
        </label>
        <textarea
          id="coach-eval-notes"
          rows={6}
          maxLength={MAX_NOTES}
          value={notesText}
          onChange={handleNotesChange}
          disabled={saving || deleting}
          placeholder="Scouting notes, observations, what you saw…"
          aria-describedby="coach-eval-notes-counter"
          style={{
            width:        '100%',
            background:   colors.bg,
            color:        colors.text,
            border:       `1px solid ${colors.border}`,
            borderRadius: '0.5rem',
            padding:      '0.75rem 0.85rem',
            fontSize:     '0.88rem',
            fontFamily:   'inherit',
            lineHeight:   1.55,
            resize:       'vertical',
            outline:      'none',
            boxSizing:    'border-box',
            opacity:      saving || deleting ? 0.7 : 1,
          }}
        />
        <div
          id="coach-eval-notes-counter"
          aria-live="polite"
          style={{
            ...mono,
            textAlign: 'right',
            fontSize:  '0.7rem',
            color:     counterColor,
            marginTop: '0.3rem',
          }}
        >
          {notesText.length} / {MAX_NOTES}
        </div>
      </div>

      {/* ── Inline error ───────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          style={{
            color:        colors.error,
            fontSize:     '0.78rem',
            margin:       '0.85rem 0 0',
            background:   'rgba(248,113,113,0.08)',
            border:       `1px solid rgba(248,113,113,0.25)`,
            borderRadius: '0.4rem',
            padding:      '0.5rem 0.65rem',
          }}
        >
          {error}
        </p>
      )}

      {/* ── Actions row ────────────────────────────────────────────────── */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '0.75rem',
          flexWrap:   'wrap',
          marginTop:  '1rem',
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          aria-label={note ? 'Save changes to evaluation' : 'Save evaluation'}
          style={{
            background:   canSave ? colors.gold : 'rgba(232,160,32,0.22)',
            color:        canSave ? colors.goldFg : 'rgba(10,14,20,0.55)',
            border:       'none',
            borderRadius: '0.45rem',
            padding:      '0.55rem 1.15rem',
            fontSize:     '0.82rem',
            fontWeight:   700,
            cursor:       canSave ? 'pointer' : (saving ? 'wait' : 'not-allowed'),
            letterSpacing: '0.02em',
          }}
        >
          {saving ? 'Saving…' : note ? 'Save changes' : 'Save evaluation'}
        </button>

        {savedToast && (
          <span
            role="status"
            style={{
              ...mono,
              color:    colors.gold,
              fontSize: '0.78rem',
              opacity:  0.95,
              transition: 'opacity 200ms',
            }}
          >
            Saved.
          </span>
        )}

        <div style={{ flex: 1 }} />

        {note && !confirmDelete && (
          <button
            type="button"
            onClick={() => { clearError(); setConfirmDelete(true); }}
            disabled={saving || deleting}
            aria-label="Delete evaluation"
            style={{
              background:    'transparent',
              color:         colors.error,
              border:        'none',
              fontSize:      '0.78rem',
              fontWeight:    500,
              cursor:        saving ? 'wait' : 'pointer',
              padding:       '0.4rem 0.25rem',
              textDecoration: 'underline',
              textUnderlineOffset: '0.2em',
              opacity:       saving || deleting ? 0.5 : 1,
            }}
          >
            Delete
          </button>
        )}

        {note && confirmDelete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ color: colors.error, fontSize: '0.78rem' }}>
              Delete this evaluation? This can&apos;t be undone.
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Confirm delete evaluation"
              style={{
                background:    'transparent',
                color:         colors.error,
                border:        'none',
                fontSize:      '0.78rem',
                fontWeight:    700,
                cursor:        deleting ? 'wait' : 'pointer',
                textDecoration: 'underline',
                padding:       '0.2rem 0.25rem',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              aria-label="Cancel delete"
              style={{
                background:    'transparent',
                color:         colors.muted,
                border:        'none',
                fontSize:      '0.78rem',
                cursor:        deleting ? 'wait' : 'pointer',
                textDecoration: 'underline',
                padding:       '0.2rem 0.25rem',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header (title + subtitle + last-updated) ──────────────────────────────
function Header({ note }: { note: Note | null }) {
  return (
    <div>
      <h2 style={{
        color:         colors.text,
        fontSize:      '1.05rem',
        fontWeight:    700,
        margin:        0,
        letterSpacing: '-0.01em',
      }}>
        Your Evaluation
      </h2>
      <p style={{
        ...mono,
        color:    colors.muted,
        fontSize: '0.72rem',
        margin:   '0.25rem 0 0',
        letterSpacing: '0.04em',
      }}>
        Private — not shown to the athlete.
      </p>
      {note && (
        <p style={{
          ...mono,
          color:    colors.muted,
          fontSize: '0.7rem',
          margin:   '0.4rem 0 0',
          opacity:  0.85,
        }}>
          Last updated {formatRelativeTime(note.updatedAt)}
        </p>
      )}
    </div>
  );
}

