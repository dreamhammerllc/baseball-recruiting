'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  coachId: string;
  athleteId: string;
  athleteName: string;
  athletePhoto: string | null;
  athletePosition: string | null;
  athleteGradYear: number | null;
  alreadyConnected: boolean;
}

export default function ConnectPageClient({
  coachId,
  athleteId,
  athleteName,
  athletePhoto,
  athletePosition,
  athleteGradYear,
  alreadyConnected,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyConnected);
  const [error, setError] = useState('');

  async function handleConnect() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/connections/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Something went wrong');
      }
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const initials = athleteName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '1rem',
        padding: '2.5rem',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <p style={{ color: '#e8a020', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 2rem', letterSpacing: '-0.01em' }}>
          Diamond Verified
        </p>

        {/* Athlete avatar */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#1e2530',
          border: '3px solid #e8a020',
          margin: '0 auto 1rem',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {athletePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={athletePhoto} alt={athleteName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '1.4rem' }}>{initials}</span>
          )}
        </div>

        <h1 style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
          {athleteName}
        </h1>
        {(athletePosition || athleteGradYear) && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 2rem' }}>
            {[athletePosition, athleteGradYear ? `Class of ${athleteGradYear}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {done ? (
          <>
            <div style={{ color: '#22c55e', fontSize: '2.5rem', margin: '0 0 0.75rem' }}>✓</div>
            <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '1rem', margin: '0 0 0.5rem' }}>
              {alreadyConnected && !loading ? 'Already Connected' : 'Connected!'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              {athleteName} is now on your roster.
            </p>
            <button
              onClick={() => router.push('/dashboard/coach/athletes')}
              style={{
                backgroundColor: '#e8a020',
                color: '#000000',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              View My Athletes
            </button>
          </>
        ) : (
          <>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              Add this athlete to your roster so you can track their metrics and submit coach-verified stats.
            </p>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 1rem' }}>{error}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#92400e' : '#e8a020',
                color: '#000000',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                width: '100%',
                marginBottom: '0.75rem',
              }}
            >
              {loading ? 'Connecting...' : 'Add to My Roster'}
            </button>
            <button
              onClick={() => router.push('/dashboard/coach')}
              style={{
                backgroundColor: 'transparent',
                color: '#6b7280',
                fontWeight: 500,
                fontSize: '0.85rem',
                padding: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
