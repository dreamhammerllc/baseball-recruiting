'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  athleteId:       string;
  athleteName:     string;
  athletePhoto:    string | null;
  athleteUsername: string | null;
  initialSaved:    boolean;
}

export default function CoachActionBar({
  athleteId,
  athleteName,
  athletePhoto,
  athleteUsername,
  initialSaved,
}: Props) {
  const router = useRouter();
  const [saved, setSaved]               = useState(initialSaved);
  const [saving, setSaving]             = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving]         = useState(false);
  const [error, setError]               = useState<string | null>(null);

  async function toggleSave() {
    setSaving(true);
    setError(null);
    try {
      if (saved) {
        const res = await fetch(`/api/coach/saved-athletes?athlete_clerk_id=${encodeURIComponent(athleteId)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to unsave');
        setSaved(false);
      } else {
        const res = await fetch('/api/coach/saved-athletes', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            athlete_clerk_id: athleteId,
            athlete_name:     athleteName,
            athlete_photo:    athletePhoto,
            athlete_username: athleteUsername,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save');
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeFromRoster() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/athletes/${encodeURIComponent(athleteId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to remove');
      router.push('/dashboard/coach/athletes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
      setRemoving(false);
    }
  }

  function openVerifyFlow() {
    const qs = new URLSearchParams({
      athleteId,
      athleteName,
      athletePhoto:    athletePhoto    ?? '',
      athleteUsername: athleteUsername ?? '',
    });
    router.push(`/dashboard/coach?${qs.toString()}`);
  }

  return (
    <div
      style={{
        display:        'flex',
        flexWrap:       'wrap',
        gap:            '0.6rem',
        background:     '#111827',
        border:         '1px solid #1e2530',
        borderRadius:   '0.75rem',
        padding:        '0.85rem',
        marginBottom:   '2rem',
        alignItems:     'center',
      }}
    >
      <button
        type="button"
        onClick={openVerifyFlow}
        style={{
          background:    '#e8a020',
          color:         '#0a0e14',
          border:        'none',
          borderRadius:  '0.45rem',
          padding:       '0.5rem 0.95rem',
          fontSize:      '0.8rem',
          fontWeight:    700,
          cursor:        'pointer',
        }}
      >
        ◆ Verify Metric
      </button>

      <button
        type="button"
        onClick={toggleSave}
        disabled={saving}
        style={{
          background:    saved ? 'rgba(232,160,32,0.12)' : 'transparent',
          color:         saved ? '#e8a020' : '#9ca3af',
          border:        `1px solid ${saved ? '#e8a020' : '#1e2530'}`,
          borderRadius:  '0.45rem',
          padding:       '0.5rem 0.95rem',
          fontSize:      '0.8rem',
          fontWeight:    600,
          cursor:        saving ? 'wait' : 'pointer',
          opacity:       saving ? 0.6 : 1,
        }}
      >
        {saved ? '★ Saved' : '☆ Save'}
      </button>

      <div style={{ flex: 1 }} />

      {!confirmRemove ? (
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          style={{
            background:    'transparent',
            color:         '#6b7280',
            border:        '1px solid #1e2530',
            borderRadius:  '0.45rem',
            padding:       '0.5rem 0.95rem',
            fontSize:      '0.8rem',
            fontWeight:    500,
            cursor:        'pointer',
          }}
        >
          Remove from Roster
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#f87171' }}>Remove {athleteName}?</span>
          <button
            type="button"
            onClick={removeFromRoster}
            disabled={removing}
            style={{
              background:   '#ef4444',
              color:        '#fff',
              border:       'none',
              borderRadius: '0.4rem',
              padding:      '0.35rem 0.85rem',
              fontSize:     '0.78rem',
              fontWeight:   700,
              cursor:       removing ? 'wait' : 'pointer',
              opacity:      removing ? 0.6 : 1,
            }}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmRemove(false)}
            disabled={removing}
            style={{
              background:   'transparent',
              color:        '#9ca3af',
              border:       'none',
              fontSize:     '0.78rem',
              cursor:       'pointer',
            }}
          >
            Keep
          </button>
        </div>
      )}

      {error && (
        <div style={{ flexBasis: '100%', color: '#f87171', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
