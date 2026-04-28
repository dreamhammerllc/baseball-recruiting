'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedProspect {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatName(p: SavedProspect): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed Athlete';
}

function isPitcher(position: string | null): boolean {
  return (position ?? '').toLowerCase().includes('pitcher') || position === 'P';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SavedProspectsList({
  initialProspects,
}: {
  initialProspects: SavedProspect[];
}) {
  // Local list — items are removed optimistically on "Remove"
  const [prospects, setProspects] = useState<SavedProspect[]>(initialProspects);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  async function handleRemove(athleteClerkId: string) {
    if (removing.has(athleteClerkId)) return;

    // Optimistic removal
    setProspects((prev) => prev.filter((p) => p.clerk_user_id !== athleteClerkId));
    setRemoving((prev) => new Set(prev).add(athleteClerkId));

    try {
      const res = await fetch('/api/save-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteClerkId }),
      });
      const json = await res.json() as { saved?: boolean; error?: string };

      if (!res.ok || json.error) {
        // Roll back — put the prospect back in the list
        setProspects((prev) => {
          const original = initialProspects.find((p) => p.clerk_user_id === athleteClerkId);
          if (!original) return prev;
          return [...prev, original].sort((a, b) =>
            formatName(a).localeCompare(formatName(b)),
          );
        });
      }
      // If server says saved:true it means the toggle re-saved it (shouldn't
      // happen here since we're removing), but we trust our optimistic state.
    } catch {
      // Network error — restore the card
      setProspects((prev) => {
        const original = initialProspects.find((p) => p.clerk_user_id === athleteClerkId);
        if (!original) return prev;
        return [...prev, original].sort((a, b) =>
          formatName(a).localeCompare(formatName(b)),
        );
      });
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(athleteClerkId);
        return next;
      });
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (prospects.length === 0) {
    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        padding: '5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <svg
          width="44" height="44" viewBox="0 0 24 24"
          fill="none" stroke="#374151" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
        <p style={{ color: '#4b5563', fontSize: '0.9rem', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
          No saved prospects yet.{' '}
          <Link
            href="/dashboard/college"
            style={{ color: '#e8a020', textDecoration: 'none', fontWeight: 600 }}
          >
            Find athletes in Prospect Search.
          </Link>
        </p>
      </div>
    );
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {prospects.map((p) => (
        <SavedCard
          key={p.clerk_user_id}
          prospect={p}
          removing={removing.has(p.clerk_user_id)}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SavedCard({
  prospect: p,
  removing,
  onRemove,
}: {
  prospect: SavedProspect;
  removing: boolean;
  onRemove: (id: string) => void;
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
      border: '1px solid rgba(232,160,32,0.35)',
      borderRadius: '0.75rem',
      padding: '1.1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      opacity: removing ? 0.4 : 1,
      transition: 'opacity 0.15s',
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
          {p.grad_year && <StatChip label="Class" value={p.grad_year} />}
          {p.home_state && <StatChip label="State" value={p.home_state} />}
          {gpa != null && <StatChip label="GPA" value={gpa.toFixed(2)} />}
          {veloValue != null && <StatChip label={veloLabel} value={`${veloValue} mph`} />}
          {p.division_pref && <StatChip label="Target" value={p.division_pref} />}
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

      {/* Remove button */}
      <button
        onClick={() => onRemove(p.clerk_user_id)}
        disabled={removing}
        title="Remove from saved"
        style={{
          flexShrink: 0,
          padding: '0.5rem 0.85rem',
          backgroundColor: 'transparent',
          border: '1px solid #374151',
          borderRadius: '0.45rem',
          color: '#6b7280',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: removing ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          transition: 'border-color 0.15s, color 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
        Remove
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
      <span style={{ color: '#4b5563', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ color: '#d1d5db', fontSize: '0.82rem', fontWeight: 600 }}>
        {value}
      </span>
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
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="#ffffff" fontSize="0.7rem" fontWeight={700}
      >
        {score}
      </text>
    </svg>
  );
}
