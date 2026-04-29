'use client';

import { useState, useEffect } from 'react';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

interface Booking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  metric_keys: string[];
  status: 'confirmed' | 'cancelled' | 'completed';
  athlete_notes: string | null;
  coach: {
    full_name: string;
    title: string;
    organization: string;
    photo_url: string | null;
    email: string;
  };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  confirmed:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  label: 'Confirmed' },
  completed:  { color: '#58a6ff', bg: 'rgba(88,166,255,0.1)',  label: 'Completed' },
  cancelled:  { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Cancelled' },
};

export default function AthleteBookingsPage() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirm, setConfirm]       = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bookings')
      .then(r => r.json())
      .then(d => setBookings(d.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function cancelBooking(id: string) {
    setCancelling(id);
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    } catch { /* ignore */ }
    finally { setCancelling(null); setConfirm(null); }
  }

  const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.scheduled_at) >= new Date());
  const past     = bookings.filter(b => b.status !== 'confirmed' || new Date(b.scheduled_at) < new Date());

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>My Bookings</h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Your upcoming and past testing sessions.</p>
          </div>

          {loading && <p style={{ color: '#6b7280', fontFamily: 'monospace' }}>Loading...</p>}

          {!loading && bookings.length === 0 && (
            <div style={{ backgroundColor: '#111827', border: '1px dashed #1e2530', borderRadius: '0.75rem', padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: '#f0f6fc', fontWeight: 600, margin: '0 0 0.5rem' }}>No sessions booked yet</p>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                Find a verified coach near you to book your first testing session.
              </p>
              <a href="/dashboard/athlete/find-coaches" style={{ display: 'inline-block', backgroundColor: '#e8a020', color: '#000', fontWeight: 700, padding: '0.6rem 1.5rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem' }}>
                Find Coaches →
              </a>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>Upcoming</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcoming.map(b => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    showCancel
                    confirming={confirm === b.id}
                    cancelling={cancelling === b.id}
                    onCancelRequest={() => setConfirm(b.id)}
                    onCancelConfirm={() => cancelBooking(b.id)}
                    onCancelDismiss={() => setConfirm(null)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1rem' }}>Past Sessions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {past.map(b => <BookingCard key={b.id} booking={b} />)}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function BookingCard({
  booking: b,
  showCancel,
  confirming,
  cancelling,
  onCancelRequest,
  onCancelConfirm,
  onCancelDismiss,
}: {
  booking: Booking;
  showCancel?: boolean;
  confirming?: boolean;
  cancelling?: boolean;
  onCancelRequest?: () => void;
  onCancelConfirm?: () => void;
  onCancelDismiss?: () => void;
}) {
  const statusStyle = STATUS_STYLES[b.status] ?? STATUS_STYLES.confirmed;
  const coach = b.coach;

  return (
    <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Coach avatar */}
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {coach?.photo_url
            ? <img src={coach.photo_url} alt={coach.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#e8a020', fontWeight: 700 }}>{coach?.full_name?.charAt(0) ?? '?'}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <p style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.1rem' }}>{coach?.full_name}</p>
              <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>{coach?.title} · {coach?.organization}</p>
            </div>
            <span style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderRadius: '9999px', padding: '0.15rem 0.65rem', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {statusStyle.label}
            </span>
          </div>
          <p style={{ color: '#e8a020', fontSize: '0.85rem', fontWeight: 600, margin: '0.6rem 0 0.3rem' }}>{formatDateTime(b.scheduled_at)}</p>
          <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0 0 0.4rem' }}>⏱ {b.duration_minutes} min session</p>
          {b.metric_keys?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
              {b.metric_keys.map(k => (
                <span key={k} style={{ backgroundColor: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)', color: '#58a6ff', borderRadius: '9999px', padding: '0.1rem 0.55rem', fontSize: '0.7rem' }}>
                  {METRIC_INFO[k as MetricKey]?.label ?? k}
                </span>
              ))}
            </div>
          )}
          {/* Cancel flow */}
          {showCancel && !confirming && (
            <button type="button" onClick={onCancelRequest} style={{ marginTop: '0.75rem', background: 'none', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
              Cancel Session
            </button>
          )}
          {confirming && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#f87171', fontSize: '0.8rem' }}>Cancel this session?</span>
              <button type="button" onClick={onCancelConfirm} disabled={cancelling} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.35rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
              <button type="button" onClick={onCancelDismiss} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}>Keep it</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
