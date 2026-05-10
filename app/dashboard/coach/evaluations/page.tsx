'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CoachSidebar from '@/components/layout/CoachSidebar';
import { formatRelativeTime } from '@/lib/time';

interface NoteWithAthlete {
  id:        string;
  athleteId: string;
  athlete: {
    firstName:       string | null;
    lastName:        string | null;
    position:        string | null;
    graduationYear:  number | null;
    state:           string | null;
    profilePhotoUrl: string | null;
  };
  rating:    number | null;
  notes:     string | null;
  createdAt: string;
  updatedAt: string;
}

type SortKey = 'recent' | 'ratingDesc' | 'ratingAsc' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  recent:     'Recently updated',
  ratingDesc: 'Highest rated',
  ratingAsc:  'Lowest rated',
  name:       'Name A–Z',
};

const NOTES_PREVIEW_CHARS = 150;

export default function CoachEvaluationsPage() {
  const [notes,   setNotes]   = useState<NoteWithAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sort,    setSort]    = useState<SortKey>('recent');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/coach/notes');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to load evaluations.');
        setNotes([]);
        return;
      }
      setNotes((data.notes ?? []) as NoteWithAthlete[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evaluations.');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    const list = [...notes];
    switch (sort) {
      case 'ratingDesc':
        list.sort((a, b) => compareRatings(a.rating, b.rating, 'desc') || compareUpdated(a, b));
        break;
      case 'ratingAsc':
        list.sort((a, b) => compareRatings(a.rating, b.rating, 'asc')  || compareUpdated(a, b));
        break;
      case 'name':
        list.sort((a, b) =>
          fullName(a).localeCompare(fullName(b), undefined, { sensitivity: 'base' }) ||
          compareUpdated(a, b),
        );
        break;
      case 'recent':
      default:
        list.sort(compareUpdated);
        break;
    }
    return list;
  }, [notes, sort]);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <CoachSidebar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280' }}>Loading evaluations…</p>
        </main>
      </div>
    );
  }

  // ── Body ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px' }}>

          {/* Header */}
          <div style={{
            marginBottom:  '1.5rem',
            display:       'flex',
            alignItems:    'flex-start',
            justifyContent:'space-between',
            flexWrap:      'wrap',
            gap:           '1rem',
          }}>
            <div>
              <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
                Evaluations
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {notes.length} evaluation{notes.length === 1 ? '' : 's'}
              </p>
            </div>
            {notes.length > 0 && (
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                style={selectStyle}
                aria-label="Sort evaluations"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <option key={k} value={k}>{SORT_LABELS[k]}</option>
                ))}
              </select>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(248,113,113,0.08)',
              border:          '1px solid rgba(248,113,113,0.3)',
              borderRadius:    '0.75rem',
              padding:         '1rem 1.25rem',
              marginBottom:    '1rem',
              display:         'flex',
              alignItems:      'center',
              gap:             '0.85rem',
              flexWrap:        'wrap',
            }}>
              <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0, flex: 1, minWidth: '160px' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={load}
                style={{
                  backgroundColor: 'transparent',
                  color:           '#f87171',
                  border:          '1px solid rgba(248,113,113,0.4)',
                  borderRadius:    '0.4rem',
                  padding:         '0.4rem 0.95rem',
                  fontSize:        '0.78rem',
                  fontWeight:      700,
                  cursor:          'pointer',
                  fontFamily:      'monospace',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!error && notes.length === 0 && (
            <div style={{
              backgroundColor: '#111827',
              border:          '1px dashed #1e2530',
              borderRadius:    '0.75rem',
              padding:         '3rem 2rem',
              textAlign:       'center',
            }}>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0, lineHeight: 1.55 }}>
                No evaluations yet. Create one from any athlete&apos;s detail page.
              </p>
            </div>
          )}

          {/* List */}
          {!error && sorted.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {sorted.map(n => <EvaluationCard key={n.id} note={n} />)}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function EvaluationCard({ note }: { note: NoteWithAthlete }) {
  const [hover, setHover] = useState(false);
  const fullN    = fullName(note);
  const initials = fullN.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const photo    = note.athlete.profilePhotoUrl;

  const trimmed = (note.notes ?? '').trim();
  const preview =
    trimmed === '' ? null :
    trimmed.length > NOTES_PREVIEW_CHARS ? `${trimmed.slice(0, NOTES_PREVIEW_CHARS)}…` :
    trimmed;

  const hasMeta = note.athlete.position || note.athlete.graduationYear || note.athlete.state;

  return (
    <Link
      href={`/dashboard/coach/athletes/${note.athleteId}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Open ${fullN}'s profile to edit evaluation`}
      style={{
        display:        'block',
        textDecoration: 'none',
        backgroundColor: hover ? '#151c2a' : '#111827',
        border:         `1px solid ${hover ? '#30363d' : '#1e2530'}`,
        borderRadius:   '0.75rem',
        padding:        '0.9rem 1.1rem',
        transition:     'background-color 120ms, border-color 120ms',
      }}
    >
      {/* Top row: avatar + name/pills + rating */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Avatar — same treatment as My Athletes */}
        <div style={{
          width:           '44px',
          height:          '44px',
          borderRadius:    '50%',
          overflow:        'hidden',
          backgroundColor: 'rgba(232,160,32,0.1)',
          border:          '1px solid rgba(232,160,32,0.2)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
        }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={fullN} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '0.9rem' }}>{initials}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color:        '#f0f6fc',
            fontWeight:   600,
            fontSize:     '0.95rem',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {fullN}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
            {note.athlete.position       && <Pill>{note.athlete.position}</Pill>}
            {note.athlete.graduationYear && <Pill>{`'${String(note.athlete.graduationYear).slice(-2)}`}</Pill>}
            {note.athlete.state          && <Pill muted>{note.athlete.state}</Pill>}
            {!hasMeta                    && <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>No profile data</span>}
          </div>
        </div>

        <RatingBadge rating={note.rating} />
      </div>

      {/* Notes preview */}
      <div style={{ marginTop: '0.75rem' }}>
        {preview ? (
          <p style={{
            color:      '#9ca3af',
            fontSize:   '0.82rem',
            margin:     0,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak:  'break-word',
          }}>
            {preview}
          </p>
        ) : (
          <p style={{ color: '#4b5563', fontSize: '0.82rem', fontStyle: 'italic', margin: 0 }}>
            (no notes)
          </p>
        )}
      </div>

      {/* Updated time, bottom-right */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.7rem', fontFamily: 'monospace' }}>
          Updated {formatRelativeTime(note.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) {
    return (
      <div
        aria-label="No rating"
        style={{
          width:           '44px',
          height:          '44px',
          borderRadius:    '0.5rem',
          background:      'transparent',
          border:          '1px solid #1e2530',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
          color:           '#6b7280',
          fontSize:        '1.2rem',
          fontFamily:      'monospace',
        }}
      >
        —
      </div>
    );
  }
  return (
    <div
      aria-label={`Rating ${rating} of 10`}
      style={{
        width:           '44px',
        height:          '44px',
        borderRadius:    '0.5rem',
        background:      '#e8a020',
        color:           '#0a0e14',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        fontWeight:      700,
        fontSize:        '1.05rem',
        boxShadow:       '0 1px 3px rgba(232,160,32,0.45)',
        fontFamily:      'monospace',
      }}
    >
      {rating}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background:   '#111827',
  color:        '#f0f6fc',
  border:       '1px solid #1e2530',
  borderRadius: '0.4rem',
  padding:      '0.4rem 0.6rem',
  fontSize:     '0.78rem',
  cursor:       'pointer',
};

function Pill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{
      fontFamily:    'monospace',
      background:    '#0d1117',
      border:        '1px solid #1e2530',
      borderRadius:  '0.3rem',
      padding:       '0.1rem 0.45rem',
      fontSize:      '0.65rem',
      color:         muted ? '#6b7280' : '#f0f6fc',
      letterSpacing: '0.04em',
      fontWeight:    500,
    }}>
      {children}
    </span>
  );
}

function fullName(n: NoteWithAthlete): string {
  return [n.athlete.firstName, n.athlete.lastName].filter(Boolean).join(' ') || 'Athlete';
}

function compareUpdated(a: NoteWithAthlete, b: NoteWithAthlete): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
}

// Null ratings always sort to the bottom regardless of direction.
function compareRatings(ar: number | null, br: number | null, dir: 'asc' | 'desc'): number {
  if (ar == null && br == null) return 0;
  if (ar == null) return 1;
  if (br == null) return -1;
  return dir === 'desc' ? br - ar : ar - br;
}
