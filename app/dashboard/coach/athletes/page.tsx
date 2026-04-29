'use client';

import { useState, useEffect, useCallback } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';

interface SavedAthlete {
  id: string;
  athlete_clerk_id: string;
  athlete_name: string;
  athlete_photo: string | null;
  athlete_username: string | null;
  group_id: string | null;
  saved_at: string;
}

interface AthleteGroup {
  id: string;
  name: string;
  color: string;
}

const FREE_LIMIT = 15;

export default function MyAthletesPage() {
  const [athletes, setAthletes]     = useState<SavedAthlete[]>([]);
  const [groups, setGroups]         = useState<AthleteGroup[]>([]);
  const [count, setCount]           = useState(0);
  const [limit, setLimit]           = useState<number | null>(FREE_LIMIT);
  const [isPaid, setIsPaid]         = useState(false);
  const [loading, setLoading]       = useState(true);

  // Group management
  const [newGroupName, setNewGroupName]   = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showGroupInput, setShowGroupInput] = useState(false);

  // Remove confirm
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving]           = useState<string | null>(null);

  // Move to group
  const [movingAthlete, setMovingAthlete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/saved-athletes');
      const data = await res.json();
      setAthletes(data.athletes ?? []);
      setGroups(data.groups ?? []);
      setCount(data.count ?? 0);
      // If not paid, always show the free limit (15) even if API returns null
      setLimit(data.is_paid ? null : (data.limit ?? FREE_LIMIT));
      setIsPaid(data.is_paid ?? false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeAthlete(clerkId: string) {
    setRemoving(clerkId);
    await fetch(`/api/coach/saved-athletes?athlete_clerk_id=${clerkId}`, { method: 'DELETE' });
    setAthletes(prev => prev.filter(a => a.athlete_clerk_id !== clerkId));
    setCount(c => c - 1);
    setConfirmRemove(null);
    setRemoving(null);
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    const res = await fetch('/api/coach/athlete-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    const data = await res.json();
    if (data.group) {
      setGroups(prev => [...prev, data.group]);
      setNewGroupName('');
      setShowGroupInput(false);
    }
    setCreatingGroup(false);
  }

  async function deleteGroup(groupId: string) {
    await fetch(`/api/coach/athlete-groups?group_id=${groupId}`, { method: 'DELETE' });
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setAthletes(prev => prev.map(a => a.group_id === groupId ? { ...a, group_id: null } : a));
  }

  async function moveToGroup(athleteClerkId: string, groupId: string | null) {
    setMovingAthlete(athleteClerkId);
    await fetch('/api/coach/saved-athletes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athlete_clerk_id: athleteClerkId, group_id: groupId }),
    });
    setAthletes(prev => prev.map(a =>
      a.athlete_clerk_id === athleteClerkId ? { ...a, group_id: groupId } : a
    ));
    setMovingAthlete(null);
  }

  const ungrouped = athletes.filter(a => !a.group_id);
  const isFull = !isPaid && limit !== null && count >= limit;

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1e2530',
    borderRadius: '0.75rem', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem',
  };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontFamily: 'monospace' }}>Loading...</p>
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
              <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>My Athletes</h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                {isPaid
                  ? `${count} athlete${count !== 1 ? 's' : ''} saved · Unlimited`
                  : `${count} / ${limit} athletes · Free plan`}
              </p>
            </div>
            <a href="/dashboard/coach"
              style={{ backgroundColor: '#e8a020', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '0.55rem 1.25rem', borderRadius: '0.5rem', textDecoration: 'none' }}>
              + Find Athletes
            </a>
          </div>

          {/* Free tier limit bar */}
          {!isPaid && limit !== null && (
            <div style={{ backgroundColor: '#111827', border: `1px solid ${isFull ? 'rgba(239,68,68,0.3)' : '#1e2530'}`, borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: isFull ? '#f87171' : '#9ca3af', fontSize: '0.82rem', fontWeight: 600 }}>
                  {isFull ? `Roster full (${limit}/${limit})` : `${count} of ${limit} athlete slots used`}
                </span>
                <a href="/pricing" style={{ backgroundColor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', borderRadius: '9999px', padding: '0.2rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>
                  ◆ Upgrade for unlimited + groups
                </a>
              </div>
              {/* Progress bar */}
              <div style={{ height: '5px', backgroundColor: '#1e2530', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (count / limit) * 100)}%`, backgroundColor: isFull ? '#ef4444' : '#e8a020', borderRadius: '999px', transition: 'width 0.3s' }} />
              </div>
              {isFull && (
                <p style={{ color: '#f87171', fontSize: '0.78rem', margin: '0.5rem 0 0' }}>
                  Remove an athlete before adding a new one, or upgrade for unlimited.
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {athletes.length === 0 && (
            <div style={{ backgroundColor: '#111827', border: '1px dashed #1e2530', borderRadius: '0.75rem', padding: '3rem 2rem', textAlign: 'center' }}>
              <p style={{ color: '#f0f6fc', fontWeight: 600, margin: '0 0 0.5rem' }}>No athletes saved yet</p>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                Search for athletes from the Dashboard and tap <strong style={{ color: '#e8a020' }}>+ Save</strong> to add them here.
              </p>
            </div>
          )}

          {/* Paid: Groups section */}
          {isPaid && athletes.length > 0 && (
            <>
              {/* Create group button */}
              <div style={{ marginBottom: '1.25rem' }}>
                {!showGroupInput ? (
                  <button type="button" onClick={() => setShowGroupInput(true)}
                    style={{ backgroundColor: 'transparent', border: '1px dashed #374151', borderRadius: '0.5rem', color: '#6b7280', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, padding: '0.45rem 1rem' }}>
                    + New Group
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Group name (e.g. Pitchers, 2025 Class)"
                      onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') setShowGroupInput(false); }}
                      autoFocus
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.4rem', color: '#f0f6fc', padding: '0.45rem 0.75rem', fontSize: '0.85rem', outline: 'none', width: '220px' }} />
                    <button type="button" onClick={createGroup} disabled={creatingGroup}
                      style={{ backgroundColor: '#e8a020', color: '#000', border: 'none', borderRadius: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                      {creatingGroup ? 'Creating...' : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowGroupInput(false)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                  </div>
                )}
              </div>

              {/* Groups */}
              {groups.map(group => {
                const groupAthletes = athletes.filter(a => a.group_id === group.id);
                return (
                  <div key={group.id} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: group.color, flexShrink: 0 }} />
                      <span style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.9rem' }}>{group.name}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{groupAthletes.length} athlete{groupAthletes.length !== 1 ? 's' : ''}</span>
                      <button type="button" onClick={() => deleteGroup(group.id)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '0.72rem' }}>
                        Delete group
                      </button>
                    </div>
                    {groupAthletes.length === 0 ? (
                      <p style={{ color: '#374151', fontSize: '0.8rem', paddingLeft: '1rem' }}>No athletes in this group yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {groupAthletes.map(a => (
                          <AthleteCard key={a.id} athlete={a} groups={groups} isPaid={isPaid}
                            confirmRemove={confirmRemove} removing={removing} movingAthlete={movingAthlete}
                            onRemoveRequest={() => setConfirmRemove(a.athlete_clerk_id)}
                            onRemoveConfirm={() => removeAthlete(a.athlete_clerk_id)}
                            onRemoveDismiss={() => setConfirmRemove(null)}
                            onMoveToGroup={(gId) => moveToGroup(a.athlete_clerk_id, gId)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped */}
              {ungrouped.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ color: '#4b5563', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.6rem' }}>
                    Ungrouped
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {ungrouped.map(a => (
                      <AthleteCard key={a.id} athlete={a} groups={groups} isPaid={isPaid}
                        confirmRemove={confirmRemove} removing={removing} movingAthlete={movingAthlete}
                        onRemoveRequest={() => setConfirmRemove(a.athlete_clerk_id)}
                        onRemoveConfirm={() => removeAthlete(a.athlete_clerk_id)}
                        onRemoveDismiss={() => setConfirmRemove(null)}
                        onMoveToGroup={(gId) => moveToGroup(a.athlete_clerk_id, gId)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Free: flat list */}
          {!isPaid && athletes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {athletes.map(a => (
                <AthleteCard key={a.id} athlete={a} groups={[]} isPaid={false}
                  confirmRemove={confirmRemove} removing={removing} movingAthlete={null}
                  onRemoveRequest={() => setConfirmRemove(a.athlete_clerk_id)}
                  onRemoveConfirm={() => removeAthlete(a.athlete_clerk_id)}
                  onRemoveDismiss={() => setConfirmRemove(null)}
                  onMoveToGroup={() => {}} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Athlete Card ──────────────────────────────────────────────────────────────
function AthleteCard({ athlete: a, groups, isPaid, confirmRemove, removing, movingAthlete, onRemoveRequest, onRemoveConfirm, onRemoveDismiss, onMoveToGroup }: {
  athlete: SavedAthlete;
  groups: AthleteGroup[];
  isPaid: boolean;
  confirmRemove: string | null;
  removing: string | null;
  movingAthlete: string | null;
  onRemoveRequest: () => void;
  onRemoveConfirm: () => void;
  onRemoveDismiss: () => void;
  onMoveToGroup: (groupId: string | null) => void;
}) {
  const isConfirming = confirmRemove === a.athlete_clerk_id;
  const isRemoving   = removing === a.athlete_clerk_id;
  const isMoving     = movingAthlete === a.athlete_clerk_id;
  const [showMove, setShowMove] = useState(false);

  return (
    <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '0.85rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {a.athlete_photo
            ? <img src={a.athlete_photo} alt={a.athlete_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#e8a020', fontWeight: 700 }}>{a.athlete_name.charAt(0)}</span>
          }
        </div>
        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{a.athlete_name}</p>
          {a.athlete_username && <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>@{a.athlete_username}</p>}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isPaid && groups.length > 0 && !isConfirming && (
            <button type="button" onClick={() => setShowMove(v => !v)}
              style={{ backgroundColor: 'transparent', border: '1px solid #1e2530', borderRadius: '0.4rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500, padding: '0.3rem 0.65rem' }}>
              {isMoving ? 'Moving...' : 'Move'}
            </button>
          )}
          {a.athlete_username && (
            <a href={`/profile/${a.athlete_username}`} target="_blank" rel="noopener noreferrer"
              style={{ backgroundColor: 'transparent', border: '1px solid #1e2530', borderRadius: '0.4rem', color: '#58a6ff', fontSize: '0.72rem', fontWeight: 500, padding: '0.3rem 0.65rem', textDecoration: 'none' }}>
              View Profile
            </a>
          )}
          {!isConfirming && (
            <button type="button" onClick={onRemoveRequest}
              style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '0.72rem', padding: '0.3rem' }}>✕</button>
          )}
        </div>
      </div>

      {/* Move to group dropdown */}
      {showMove && isPaid && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #1e2530', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', marginRight: '0.25rem' }}>Move to:</span>
          <button type="button" onClick={() => { onMoveToGroup(null); setShowMove(false); }}
            style={{ border: '1px solid #374151', borderRadius: '9999px', backgroundColor: !a.group_id ? 'rgba(107,114,128,0.15)' : 'transparent', color: !a.group_id ? '#9ca3af' : '#6b7280', fontSize: '0.72rem', padding: '0.2rem 0.65rem', cursor: 'pointer' }}>
            Ungrouped
          </button>
          {groups.map(g => (
            <button key={g.id} type="button" onClick={() => { onMoveToGroup(g.id); setShowMove(false); }}
              style={{ border: `1px solid ${g.color}44`, borderRadius: '9999px', backgroundColor: a.group_id === g.id ? `${g.color}22` : 'transparent', color: g.color, fontSize: '0.72rem', padding: '0.2rem 0.65rem', cursor: 'pointer' }}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Confirm remove */}
      {isConfirming && (
        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#f87171', fontSize: '0.78rem' }}>Remove from roster?</span>
          <button type="button" onClick={onRemoveConfirm} disabled={isRemoving}
            style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.35rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            {isRemoving ? 'Removing...' : 'Remove'}
          </button>
          <button type="button" onClick={onRemoveDismiss}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}>Keep</button>
        </div>
      )}
    </div>
  );
}
