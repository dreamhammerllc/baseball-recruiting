'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';
import AddAthleteModal from '@/components/AddAthleteModal';
import Pill from '@/components/ui/Pill';
import VerifiedBadge from '@/components/VerifiedBadge';
import { selectStyle } from '@/lib/ui/selectStyle';

interface ConnectedAthlete {
  connectionId: string;
  athleteId:    string;
  connectedAt:  string;
  name:         string;
  photo:        string | null;
  position:     string | null;
  graduationYear: number | null;
  state:        string | null;
  updatedAt:    string | null;
  verified:     boolean;
  verification_tier: number;
  username:     string | null;
}

type SortKey = 'name' | 'gradYearAsc' | 'connectedDesc';
interface Filters { position: string; graduationYear: string }
const EMPTY_FILTERS: Filters = { position: '', graduationYear: '' };

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default function MyAthletesPage() {
  const router = useRouter();
  const [athletes, setAthletes]   = useState<ConnectedAthlete[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Remove confirm
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving]           = useState<string | null>(null);

  // Filters + sort
  const [filters, setFilters]               = useState<Filters>(EMPTY_FILTERS);
  const [recentlyActive, setRecentlyActive] = useState(false);
  const [sort, setSort]                     = useState<SortKey>('name');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/connections');
      const data = await res.json();
      setAthletes(data.athletes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Facets — derived from the full connected roster, not the filtered set,
  // so changing one filter doesn't shrink the others' options.
  const availablePositions = useMemo(() => {
    const s = new Set<string>();
    for (const a of athletes) if (a.position) s.add(a.position);
    return [...s].sort();
  }, [athletes]);

  const availableGradYears = useMemo(() => {
    const s = new Set<number>();
    for (const a of athletes) if (a.graduationYear != null) s.add(a.graduationYear);
    return [...s].sort((x, y) => x - y);
  }, [athletes]);

  // Filtered + sorted view
  const visibleAthletes = useMemo(() => {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    let r = athletes;
    if (filters.position) {
      r = r.filter(a => a.position === filters.position);
    }
    if (filters.graduationYear) {
      const y = Number(filters.graduationYear);
      r = r.filter(a => a.graduationYear === y);
    }
    if (recentlyActive) {
      r = r.filter(a => a.updatedAt != null && new Date(a.updatedAt).getTime() >= cutoff);
    }
    const sorted = [...r];
    if (sort === 'name') {
      sorted.sort((x, y) => x.name.localeCompare(y.name));
    } else if (sort === 'gradYearAsc') {
      sorted.sort((x, y) => {
        const xy = x.graduationYear ?? Number.POSITIVE_INFINITY;
        const yy = y.graduationYear ?? Number.POSITIVE_INFINITY;
        if (xy !== yy) return xy - yy;
        return x.name.localeCompare(y.name);
      });
    } else {
      // connectedDesc — most recent first
      sorted.sort((x, y) =>
        x.connectedAt < y.connectedAt ? 1 :
        x.connectedAt > y.connectedAt ? -1 : 0
      );
    }
    return sorted;
  }, [athletes, filters, recentlyActive, sort]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setRecentlyActive(false);
  }

  async function removeAthlete(athleteId: string) {
    setRemoving(athleteId);
    await fetch(`/api/coach/connections?athleteId=${athleteId}`, { method: 'DELETE' });
    setAthletes(prev => prev.filter(a => a.athleteId !== athleteId));
    setConfirmRemove(null);
    setRemoving(null);
  }

  function openVerifyFlow(athlete: ConnectedAthlete) {
    const params = new URLSearchParams({
      athleteId:    athlete.athleteId,
      athleteName:  athlete.name,
      athletePhoto: athlete.photo ?? '',
      athleteUsername: athlete.username ?? '',
    });
    router.push(`/dashboard/coach?${params.toString()}`);
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </main>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px' }}>

          {/* Header */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
                My Athletes
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {athletes.length} athlete{athletes.length !== 1 ? 's' : ''} connected
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                backgroundColor: '#e8a020', color: '#000000', fontWeight: 700,
                fontSize: '0.85rem', padding: '0.55rem 1.25rem',
                borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              }}
            >
              + Add Athlete
            </button>
          </div>

          {/* Empty state — never connected */}
          {athletes.length === 0 && (
            <div style={{
              backgroundColor: '#111827', border: '1px dashed #1e2530',
              borderRadius: '0.75rem', padding: '3rem 2rem', textAlign: 'center',
            }}>
              <p style={{ color: '#f0f6fc', fontWeight: 600, margin: '0 0 0.5rem' }}>
                No athletes connected yet
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                Tap <strong style={{ color: '#e8a020' }}>+ Add Athlete</strong> and scan their QR code or enter their invite code to add them to your roster.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  backgroundColor: '#e8a020', color: '#000000', fontWeight: 700,
                  fontSize: '0.875rem', padding: '0.65rem 1.5rem',
                  borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                }}
              >
                Add Your First Athlete
              </button>
            </div>
          )}

          {/* Filter / sort control bar */}
          {athletes.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <select
                value={filters.position}
                onChange={e => setFilters(f => ({ ...f, position: e.target.value }))}
                style={selectStyle}
                aria-label="Filter by position"
              >
                <option value="">Any position</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={filters.graduationYear}
                onChange={e => setFilters(f => ({ ...f, graduationYear: e.target.value }))}
                style={selectStyle}
                aria-label="Filter by grad year"
              >
                <option value="">Any year</option>
                {availableGradYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>

              <button
                type="button"
                onClick={() => setRecentlyActive(v => !v)}
                aria-pressed={recentlyActive}
                style={{
                  backgroundColor: recentlyActive ? 'rgba(232,160,32,0.16)' : 'transparent',
                  color:           recentlyActive ? '#e8a020' : '#6b7280',
                  border:          `1px solid ${recentlyActive ? '#e8a020' : '#1e2530'}`,
                  borderRadius:    '0.4rem',
                  padding:         '0.4rem 0.75rem',
                  fontSize:        '0.78rem',
                  fontWeight:      recentlyActive ? 700 : 500,
                  cursor:          'pointer',
                  whiteSpace:      'nowrap',
                }}
              >
                {recentlyActive ? '✓ Recently active' : 'Recently active'}
              </button>

              <div style={{ flex: 1 }} />

              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                style={selectStyle}
                aria-label="Sort"
              >
                <option value="name">Name A–Z</option>
                <option value="gradYearAsc">Grad year (earliest)</option>
                <option value="connectedDesc">Connected date (recent)</option>
              </select>
            </div>
          )}

          {/* Filter empty state — connected but nothing matches current filters */}
          {athletes.length > 0 && visibleAthletes.length === 0 && (
            <div style={{
              backgroundColor: '#111827', border: '1px dashed #1e2530',
              borderRadius: '0.75rem', padding: '2rem 1.5rem', textAlign: 'center',
            }}>
              <p style={{ color: '#f0f6fc', fontWeight: 600, margin: '0 0 0.75rem' }}>
                No athletes match these filters
              </p>
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  background: 'transparent', color: '#e8a020',
                  border: '1px solid #e8a020', borderRadius: '0.4rem',
                  padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Athlete cards */}
          {visibleAthletes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {visibleAthletes.map(a => {
                const isConfirming = confirmRemove === a.athleteId;
                const isRemoving   = removing === a.athleteId;
                const initials = a.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const hasMeta = a.position || a.graduationYear || a.state;

                return (
                  <div
                    key={a.connectionId}
                    style={{
                      backgroundColor: '#111827', border: '1px solid #1e2530',
                      borderRadius: '0.75rem', padding: '0.9rem 1.1rem',
                    }}
                  >
                    {/* Row 1: avatar + name/pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => openVerifyFlow(a)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                      >
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '50%',
                          overflow: 'hidden', backgroundColor: 'rgba(232,160,32,0.1)',
                          border: '1px solid rgba(232,160,32,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {a.photo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={a.photo} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '0.9rem' }}>{initials}</span>
                          }
                        </div>
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.9rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.name}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                          {a.position && <Pill>{a.position}</Pill>}
                          {a.graduationYear && <Pill>{`'${String(a.graduationYear).slice(-2)}`}</Pill>}
                          {a.state    && <Pill muted>{a.state}</Pill>}
                          <VerifiedBadge variant="short" verificationTier={a.verification_tier} />
                          {!hasMeta   && (
                            <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>No profile data</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openVerifyFlow(a)}
                        style={{
                          backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)',
                          borderRadius: '0.4rem', color: '#e8a020', cursor: 'pointer',
                          fontSize: '0.72rem', fontWeight: 600, padding: '0.35rem 0.75rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Verify Metric
                      </button>
                      <a
                        href={`/dashboard/coach/athletes/${a.athleteId}`}
                        style={{
                          backgroundColor: 'transparent', border: '1px solid #1e2530',
                          borderRadius: '0.4rem', color: '#58a6ff', fontSize: '0.72rem',
                          fontWeight: 500, padding: '0.35rem 0.75rem', textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Profile
                      </a>
                      <div style={{ flex: 1 }} />
                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(a.athleteId)}
                          style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Confirm remove */}
                    {isConfirming && (
                      <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #1e2530', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#f87171', fontSize: '0.78rem' }}>
                          Remove {a.name} from your roster?
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAthlete(a.athleteId)}
                          disabled={isRemoving}
                          style={{
                            backgroundColor: '#ef4444', color: '#fff', border: 'none',
                            borderRadius: '0.35rem', padding: '0.25rem 0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {isRemoving ? 'Removing...' : 'Remove'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                          style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Keep
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {showAddModal && (
        <AddAthleteModal
          onClose={() => setShowAddModal(false)}
          onConnected={(athlete) => {
            setShowAddModal(false);
            load();
            openVerifyFlow({
              connectionId: '',
              athleteId: athlete.athleteId,
              connectedAt: new Date().toISOString(),
              name: athlete.name,
              photo: athlete.photo,
              position: athlete.position,
              graduationYear: athlete.graduationYear,
              state: null,
              updatedAt: null,
              username: null,
              verified: false,
              verification_tier: 0,
            });
          }}
        />
      )}
    </div>
  );
}
