'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';
import AddAthleteModal from '@/components/AddAthleteModal';

interface ConnectedAthlete {
  connectionId: string;
  athleteId: string;
  connectedAt: string;
  name: string;
  photo: string | null;
  position: string | null;
  gradYear: number | null;
  username: string | null;
}

export default function MyAthletesPage() {
  const router = useRouter();
  const [athletes, setAthletes]   = useState<ConnectedAthlete[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Remove confirm
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving]           = useState<string | null>(null);

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

          {/* Empty state */}
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

          {/* Athlete cards */}
          {athletes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {athletes.map(a => {
                const isConfirming = confirmRemove === a.athleteId;
                const isRemoving   = removing === a.athleteId;
                const initials = a.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                return (
                  <div
                    key={a.connectionId}
                    style={{
                      backgroundColor: '#111827', border: '1px solid #1e2530',
                      borderRadius: '0.75rem', padding: '0.9rem 1.1rem',
                    }}
                  >
                    {/* Row 1: avatar + name/details */}
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
                        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.1rem 0 0' }}>
                          {[a.position, a.gradYear ? `Class of ${a.gradYear}` : null].filter(Boolean).join(' · ') || 'No position on file'}
                        </p>
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
                        href={`/profile/${a.athleteId}`}
                        target="_blank" rel="noopener noreferrer"
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
              gradYear: athlete.gradYear,
              username: null,
            });
          }}
        />
      )}
    </div>
  );
}
