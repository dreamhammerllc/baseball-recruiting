'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Prospect {
  clerk_user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  grad_year: string | null;
  home_state: string | null;
  gpa_weighted: number | null;
  gpa_unweighted: number | null;
  exit_velocity_mph: number | null;
  fastball_velocity_mph: number | null;
  division_pref: string | null;
  top_fit_score: number | null;
}

interface Filters {
  position: string;
  gradYear: string;
  divisionTarget: string;
  minGpa: string;
  minExitVelo: string;
  state: string;
}

const POSITIONS = ['All', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const GRAD_YEARS = ['All', '2025', '2026', '2027', '2028', '2029', '2030', '2031'];
const DIVISIONS = ['All', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'];

const EMPTY_FILTERS: Filters = {
  position: 'All',
  gradYear: 'All',
  divisionTarget: 'All',
  minGpa: '',
  minExitVelo: '',
  state: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatName(p: Prospect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed Athlete';
}

function formatHeight(inches: number | null): string {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function isPitcher(position: string | null): boolean {
  return (position ?? '').toLowerCase().includes('pitcher') || position === 'P';
}

// ── Select / Input shared style ───────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0d1117',
  border: '1px solid #1e2530',
  borderRadius: '0.5rem',
  color: '#d1d5db',
  fontSize: '0.85rem',
  padding: '0.55rem 0.75rem',
  outline: 'none',
  width: '100%',
  appearance: 'none' as React.CSSProperties['appearance'],
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ProspectSearch({
  prospects,
  savedProspectIds = [],
}: {
  prospects: Prospect[];
  savedProspectIds?: string[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  // Optimistic saved-set — initialised from the server-fetched IDs
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(savedProspectIds),
  );
  // Track in-flight requests to prevent double-clicks
  const [pending, setPending] = useState<Set<string>>(new Set());

  const toggleSave = useCallback(async (athleteClerkId: string) => {
    if (pending.has(athleteClerkId)) return;

    // Optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(athleteClerkId)) next.delete(athleteClerkId);
      else next.add(athleteClerkId);
      return next;
    });
    setPending((prev) => new Set(prev).add(athleteClerkId));

    try {
      const res = await fetch('/api/save-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteClerkId }),
      });
      const json = await res.json() as { saved?: boolean; error?: string };

      if (!res.ok || json.error) {
        // Roll back on failure
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (next.has(athleteClerkId)) next.delete(athleteClerkId);
          else next.add(athleteClerkId);
          return next;
        });
      } else {
        // Reconcile with server truth in case our optimistic guess was wrong
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (json.saved) next.add(athleteClerkId);
          else next.delete(athleteClerkId);
          return next;
        });
      }
    } catch {
      // Network error — roll back
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(athleteClerkId)) next.delete(athleteClerkId);
        else next.add(athleteClerkId);
        return next;
      });
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(athleteClerkId);
        return next;
      });
    }
  }, [pending]);

  function patch(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleSearch() {
    setApplied({ ...filters });
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  // Apply filters client-side
  const results = useMemo(() => {
    return prospects.filter((p) => {
      if (applied.position !== 'All') {
        const pos = (p.position ?? '').toUpperCase();
        if (!pos.includes(applied.position)) return false;
      }
      if (applied.gradYear !== 'All' && p.grad_year !== applied.gradYear) return false;
      if (applied.divisionTarget !== 'All') {
        if ((p.division_pref ?? '').toUpperCase() !== applied.divisionTarget) return false;
      }
      if (applied.minGpa) {
        const threshold = parseFloat(applied.minGpa);
        const gpa = p.gpa_weighted ?? p.gpa_unweighted ?? 0;
        if (!threshold || gpa < threshold) return false;
      }
      if (applied.minExitVelo) {
        const threshold = parseFloat(applied.minExitVelo);
        const velo = p.exit_velocity_mph ?? 0;
        if (!threshold || velo < threshold) return false;
      }
      if (applied.state) {
        const stateFilter = applied.state.trim().toLowerCase();
        if (!(p.home_state ?? '').toLowerCase().includes(stateFilter)) return false;
      }
      return true;
    });
  }, [prospects, applied]);

  const hasActiveFilters = Object.entries(applied).some(
    ([k, v]) => v !== '' && v !== 'All' && k in EMPTY_FILTERS,
  );

  return (
    <div>
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          {/* Position */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              Position
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={filters.position}
                onChange={(e) => patch('position', e.target.value)}
                style={{ ...inputStyle, paddingRight: '2rem' }}
              >
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Grad Year */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              Grad Year
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={filters.gradYear}
                onChange={(e) => patch('gradYear', e.target.value)}
                style={{ ...inputStyle, paddingRight: '2rem' }}
              >
                {GRAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Division Target */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              Division Target
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={filters.divisionTarget}
                onChange={(e) => patch('divisionTarget', e.target.value)}
                style={{ ...inputStyle, paddingRight: '2rem' }}
              >
                {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown />
            </div>
          </div>

          {/* Min GPA */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              Min GPA
            </label>
            <input
              type="number"
              min="0"
              max="4"
              step="0.1"
              placeholder="e.g. 3.0"
              value={filters.minGpa}
              onChange={(e) => patch('minGpa', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Min Exit Velo */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              Min Exit Velo
            </label>
            <input
              type="number"
              min="0"
              max="130"
              step="1"
              placeholder="e.g. 85"
              value={filters.minExitVelo}
              onChange={(e) => patch('minExitVelo', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* State */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>
              State
            </label>
            <input
              type="text"
              placeholder="e.g. TX"
              value={filters.state}
              onChange={(e) => patch('state', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <button
            onClick={handleSearch}
            style={{
              padding: '0.65rem 1.5rem',
              backgroundColor: '#e8a020',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#000000',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Search Prospects
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid #1e2530',
                borderRadius: '0.5rem',
                color: '#6b7280',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Clear filters
            </button>
          )}

          <span style={{ color: '#4b5563', fontSize: '0.8rem', marginLeft: 'auto' }}>
            {results.length} prospect{results.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {results.length === 0 ? (
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #1e2530',
          borderRadius: '0.75rem',
          padding: '4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
            {prospects.length === 0
              ? 'No verified athletes in the database yet.'
              : 'No prospects match your current filters. Try broadening your search.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.map((p) => (
            <ProspectCard
              key={p.clerk_user_id}
              prospect={p}
              saved={savedIds.has(p.clerk_user_id)}
              saving={pending.has(p.clerk_user_id)}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prospect card ─────────────────────────────────────────────────────────────

function ProspectCard({
  prospect: p,
  saved,
  saving,
  onToggleSave,
}: {
  prospect: Prospect;
  saved: boolean;
  saving: boolean;
  onToggleSave: (id: string) => void;
}) {
  const name = formatName(p);
  const gpa = p.gpa_weighted ?? p.gpa_unweighted;
  const pitcher = isPitcher(p.position);
  const veloLabel = pitcher ? 'Fastball' : 'Exit Velo';
  const veloValue = pitcher ? p.fastball_velocity_mph : p.exit_velocity_mph;
  const fitScore = p.top_fit_score;
  const ringColor = fitScore !== null
    ? fitScore >= 80 ? '#e8a020' : fitScore >= 60 ? '#3b82f6' : '#4b5563'
    : '#1e2530';

  return (
    <div style={{
      backgroundColor: '#111827',
      border: `1px solid ${saved ? 'rgba(232,160,32,0.35)' : '#1e2530'}`,
      borderRadius: '0.75rem',
      padding: '1.1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      position: 'relative',
      transition: 'border-color 0.15s',
    }}>
      {/* Verified shield */}
      <div style={{
        flexShrink: 0,
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'rgba(232,160,32,0.1)',
        border: '1px solid rgba(232,160,32,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>{name}</span>
          {p.position && (
            <span style={{
              backgroundColor: '#0d1117',
              border: '1px solid #1e2530',
              color: '#9ca3af',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              letterSpacing: '0.04em',
            }}>
              {p.position}
            </span>
          )}
          <span style={{
            backgroundColor: 'rgba(232,160,32,0.12)',
            border: '1px solid rgba(232,160,32,0.25)',
            color: '#e8a020',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Verified
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {p.grad_year && (
            <StatChip label="Class" value={p.grad_year} />
          )}
          {p.home_state && (
            <StatChip label="State" value={p.home_state} />
          )}
          {gpa != null && (
            <StatChip label="GPA" value={gpa.toFixed(2)} />
          )}
          {veloValue != null && (
            <StatChip label={veloLabel} value={`${veloValue} mph`} />
          )}
          {p.division_pref && (
            <StatChip label="Target" value={p.division_pref} />
          )}
        </div>
      </div>

      {/* Fit score ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {fitScore !== null ? (
          <>
            <FitRing score={fitScore} color={ringColor} />
            <span style={{ color: '#4b5563', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fit</span>
          </>
        ) : (
          <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>
        )}
      </div>

      {/* Bookmark button */}
      <button
        onClick={() => onToggleSave(p.clerk_user_id)}
        disabled={saving}
        title={saved ? 'Remove from saved' : 'Save prospect'}
        style={{
          flexShrink: 0,
          width: '34px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.45rem',
          border: `1px solid ${saved ? 'rgba(232,160,32,0.5)' : '#1e2530'}`,
          backgroundColor: saved ? 'rgba(232,160,32,0.12)' : 'transparent',
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.5 : 1,
          transition: 'background-color 0.15s, border-color 0.15s',
          padding: 0,
        }}
      >
        <svg
          width="15" height="15"
          viewBox="0 0 24 24"
          fill={saved ? '#e8a020' : 'none'}
          stroke={saved ? '#e8a020' : '#6b7280'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </button>

      {/* View Profile link */}
      <Link
        href={`/profile/${p.clerk_user_id}`}
        style={{
          flexShrink: 0,
          padding: '0.55rem 1rem',
          backgroundColor: 'transparent',
          border: '1px solid #1e2530',
          borderRadius: '0.5rem',
          color: '#9ca3af',
          fontSize: '0.8rem',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        View Profile
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'baseline' }}>
      <span style={{ color: '#4b5563', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: '#d1d5db', fontSize: '0.82rem', fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function FitRing({ score, color }: { score: number; color: string }) {
  const size = 48;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2530" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="#ffffff" fontSize="0.7rem" fontWeight={700}>
        {score}
      </text>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"
      style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
