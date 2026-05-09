'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Result {
  clerk_user_id:      string;
  username:           string | null;
  first_name:         string | null;
  last_name:          string | null;
  photo_url:          string | null;
  position:           string | null;
  secondary_position: string | null;
  grad_year:          number | null;
  state:              string | null;
  bats:               string | null;
  throws:             string | null;
  gpa:                number | null;
  sixty_yard:         number | null;
  fb_velo:            number | null;
  exit_velo:          number | null;
  verification_tier:  number | null;
  saved_at:           string;
}

interface ApiResponse {
  results: Result[];
  total:   number;
  is_paid: boolean;
  limit:   number | null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const colors = {
  bg:      '#0a0e14',
  surface: '#111827',
  border:  '#1e2530',
  gold:    '#e8a020',
  blue:    '#58a6ff',
  red:     '#f87171',
  text:    '#f0f6fc',
  muted:   '#6b7280',
};

const inputStyle: React.CSSProperties = {
  background:   '#0d1117',
  border:       `1px solid ${colors.border}`,
  borderRadius: '0.4rem',
  color:        colors.text,
  padding:      '0.4rem 0.6rem',
  fontSize:     '0.85rem',
  fontFamily:   'monospace',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SavedClient() {
  const [sort,    setSort]    = useState('recent');
  const [results, setResults] = useState<Result[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/coach/saved-athletes?sort=${encodeURIComponent(sort)}`);
      const json = (await res.json()) as ApiResponse | { error?: string };
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to load');
      const data = json as ApiResponse;
      setResults(data.results);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  function handleRemoved(clerkId: string) {
    // Optimistic local removal — no full refetch
    setResults(prev => prev.filter(r => r.clerk_user_id !== clerkId));
    setTotal(t => Math.max(0, t - 1));
  }

  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <p style={{ color: colors.muted, fontSize: '0.85rem', margin: 0, fontFamily: 'monospace' }}>
          {loading && results.length === 0
            ? 'Loading…'
            : `${total} athlete${total === 1 ? '' : 's'} saved`}
        </p>
        <select value={sort} onChange={e => setSort(e.target.value)} style={inputStyle}>
          <option value="recent">Recently Saved</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="position">Position</option>
        </select>
      </div>

      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: '0.5rem', padding: '0.75rem 1rem', color: colors.red,
          fontSize: '0.85rem', marginBottom: '1rem', fontFamily: 'monospace',
        }}>
          {error}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div style={{
          background: colors.surface, border: `1px dashed ${colors.border}`,
          borderRadius: '0.75rem', padding: '3rem 1.5rem', textAlign: 'center',
        }}>
          <p style={{ color: colors.text, fontWeight: 600, margin: '0 0 0.5rem' }}>
            You haven&apos;t saved any athletes yet.
          </p>
          <p style={{ color: colors.muted, fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            Find athletes you want to track on Discover, then tap the Save button.
          </p>
          <Link
            href="/dashboard/coach/discover"
            style={{
              display: 'inline-block',
              background: colors.gold, color: colors.bg, fontWeight: 700,
              fontSize: '0.85rem', padding: '0.6rem 1.5rem',
              borderRadius: '0.5rem', textDecoration: 'none', fontFamily: 'monospace',
            }}
          >
            Browse Discover →
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <div className="saved-grid">
          {results.map(r => (
            <SavedCard key={r.clerk_user_id} result={r} onRemoved={handleRemoved} />
          ))}
        </div>
      )}

      <style>{`
        .saved-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }
        @media (max-width: 1100px) {
          .saved-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 767px) {
          .saved-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SavedCard({ result, onRemoved }: { result: Result; onRemoved: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  const fullName = [result.first_name, result.last_name].filter(Boolean).join(' ') || 'Athlete';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPitcher  = result.position?.toUpperCase() === 'P' || result.position?.toUpperCase() === 'TWP';
  const isVerified = (result.verification_tier ?? 0) > 0;
  const profileHref = `/profile/${result.username ?? result.clerk_user_id}`;

  const savedDays = (() => {
    const t = Date.parse(result.saved_at);
    if (Number.isNaN(t)) return null;
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return '1 day ago';
    return `${d} days ago`;
  })();

  async function remove() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/coach/saved-athletes?athlete_clerk_id=${encodeURIComponent(result.clerk_user_id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Remove failed');
      onRemoved(result.clerk_user_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <article style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: '0.75rem', padding: '0.95rem', display: 'flex',
      flexDirection: 'column', gap: '0.7rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${colors.gold}`, background: 'rgba(232,160,32,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {result.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.photo_url} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: colors.gold, fontWeight: 700, fontSize: '1.05rem', fontFamily: 'monospace' }}>{initials}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: colors.text, fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.25rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {fullName}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {result.position           && <Pill>{result.position}</Pill>}
            {result.secondary_position && <Pill muted>{result.secondary_position}</Pill>}
            {result.grad_year          && <Pill>{`'${String(result.grad_year).slice(-2)}`}</Pill>}
            {result.state              && <Pill muted>{result.state}</Pill>}
            {isVerified                && <Pill gold>◆</Pill>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: `1px solid ${colors.border}`, paddingTop: '0.6rem' }}>
        {result.sixty_yard != null && <Metric label="60yd" value={`${result.sixty_yard}s`} />}
        {isPitcher  && result.fb_velo   != null && <Metric label="FB"   value={`${result.fb_velo} mph`} />}
        {!isPitcher && result.exit_velo != null && <Metric label="Exit" value={`${result.exit_velo} mph`} />}
        {result.gpa != null && <Metric label="GPA" value={result.gpa.toFixed(2)} />}
      </div>

      {err && <div style={{ color: colors.red, fontSize: '0.72rem', fontFamily: 'monospace' }}>{err}</div>}

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <a href={profileHref} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, background: 'transparent', color: colors.blue, border: `1px solid ${colors.border}`,
          borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontSize: '0.74rem',
          fontWeight: 600, textDecoration: 'none', textAlign: 'center', fontFamily: 'monospace',
        }}>
          View Profile
        </a>
        <button type="button" onClick={remove} disabled={busy} style={{
          background: 'transparent', color: colors.red,
          border: `1px solid rgba(248,113,113,0.3)`,
          borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontSize: '0.74rem',
          fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
          fontFamily: 'monospace',
        }}>
          {busy ? 'Removing…' : '✕ Remove'}
        </button>
      </div>

      {savedDays && (
        <p style={{
          color: colors.muted, fontSize: '0.65rem', fontFamily: 'monospace',
          margin: 0, textAlign: 'center', letterSpacing: '0.04em',
        }}>
          Saved {savedDays}
        </p>
      )}
    </article>
  );
}

function Pill({ children, muted, gold }: { children: React.ReactNode; muted?: boolean; gold?: boolean }) {
  return (
    <span style={{
      fontFamily: 'monospace',
      background: gold ? 'rgba(232,160,32,0.12)' : '#0d1117',
      border:     `1px solid ${gold ? colors.gold : colors.border}`,
      borderRadius: '0.3rem', padding: '0.1rem 0.45rem', fontSize: '0.65rem',
      color: gold ? colors.gold : muted ? colors.muted : colors.text,
      letterSpacing: '0.04em', fontWeight: gold ? 700 : 500,
    }}>
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${colors.border}`,
      borderRadius: '0.35rem', padding: '0.25rem 0.55rem',
      display: 'flex', gap: '0.35rem', alignItems: 'baseline',
    }}>
      <span style={{ color: colors.muted, fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: colors.text, fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
