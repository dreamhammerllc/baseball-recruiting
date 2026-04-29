'use client';

import { useState, useEffect } from 'react';
import { METRIC_INFO, METRIC_KEYS, type MetricKey } from '@/lib/metrics';

interface Coach {
  id: string;
  full_name: string;
  title: string;
  organization: string;
  photo_url: string | null;
  session_duration_minutes: number;
  advance_notice_hours: number;
}

interface Props {
  coach: Coach;
  onClose: () => void;
  onBooked: () => void;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatTime(isoSlot: string): string {
  return new Date(isoSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Build a 6-week calendar grid starting from today
function buildCalendar(): string[] {
  const today = new Date();
  today.setHours(0,0,0,0);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export default function BookingModal({ coach, onClose, onBooked }: Props) {
  const [step, setStep]               = useState<'date' | 'time' | 'details' | 'confirm'>('date');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots]             = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([]);
  const [notes, setNotes]             = useState('');
  const [booking, setBooking]         = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed]     = useState(false);

  const calDays = buildCalendar();

  async function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/coaches/${coach.id}/slots?date=${date}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); setStep('time'); }
  }

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function handleBook() {
    if (!selectedSlot) return;
    setBooking(true); setBookingError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id:     coach.id,
          scheduled_at: selectedSlot,
          metric_keys:  selectedMetrics,
          athlete_notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Booking failed.');
      setConfirmed(true);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally { setBooking(false); }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  };
  const modalStyle: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.875rem',
    width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  };

  // ── Confirmed state ──────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#f0f6fc', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Session Booked!</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>
              Your session with <strong style={{ color: '#f0f6fc' }}>{coach.full_name}</strong> is confirmed.
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 1.5rem' }}>
              {selectedDate && formatDateLabel(selectedDate)} at {selectedSlot && formatTime(selectedSlot)}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              A confirmation email has been sent to you and the coach. After your session, the coach will log your verified metrics directly to your profile.
            </p>
            <button onClick={() => { onBooked(); onClose(); }} style={{ backgroundColor: '#e8a020', color: '#000', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e2530', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {coach.photo_url
                ? <img src={coach.photo_url} alt={coach.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#e8a020', fontWeight: 700 }}>{coach.full_name.charAt(0)}</span>
              }
            </div>
            <div>
              <p style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>{coach.full_name}</p>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0 }}>{coach.title} · {coach.organization}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #1e2530', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {(['date','time','details'] as const).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {i > 0 && <span style={{ color: '#374151', fontSize: '0.75rem' }}>›</span>}
              <span style={{ fontSize: '0.75rem', fontWeight: step === s ? 700 : 400, color: step === s ? '#e8a020' : '#4b5563', textTransform: 'capitalize' }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>

          {/* STEP: Date */}
          {step === 'date' && (
            <>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem' }}>Select a date for your testing session:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '0.5rem' }}>
                {DAY_NAMES.map(d => (
                  <div key={d} style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.65rem', fontWeight: 600, padding: '0.25rem 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {/* Offset for start day */}
                {Array.from({ length: new Date(calDays[0] + 'T00:00:00').getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calDays.map(date => {
                  const isSelected = date === selectedDate;
                  const d = new Date(date + 'T00:00:00');
                  const isToday = date === new Date().toISOString().split('T')[0];
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => selectDate(date)}
                      style={{
                        padding: '0.5rem 0.25rem', borderRadius: '0.35rem', border: 'none', cursor: 'pointer', textAlign: 'center',
                        backgroundColor: isSelected ? '#e8a020' : isToday ? 'rgba(232,160,32,0.1)' : 'transparent',
                        color: isSelected ? '#000' : isToday ? '#e8a020' : '#9ca3af',
                        fontSize: '0.82rem', fontWeight: isSelected || isToday ? 700 : 400,
                        transition: 'background-color 0.1s',
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP: Time */}
          {step === 'time' && selectedDate && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <button type="button" onClick={() => setStep('date')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}>← Back</button>
                <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{formatDateLabel(selectedDate)}</p>
              </div>
              {loadingSlots ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading available times...</p>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <p style={{ color: '#9ca3af', margin: '0 0 0.5rem' }}>No available times on this date.</p>
                  <button type="button" onClick={() => setStep('date')} style={{ color: '#e8a020', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Choose a different date</button>
                </div>
              ) : (
                <>
                  <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem' }}>Select a time ({coach.session_duration_minutes} min session):</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
                    {slots.map(slot => {
                      const isSelected = slot === selectedSlot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => { setSelectedSlot(slot); setStep('details'); }}
                          style={{
                            padding: '0.55rem', borderRadius: '0.4rem',
                            border: `1px solid ${isSelected ? '#e8a020' : '#1e2530'}`,
                            backgroundColor: isSelected ? 'rgba(232,160,32,0.12)' : 'transparent',
                            color: isSelected ? '#e8a020' : '#9ca3af',
                            fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400, cursor: 'pointer',
                            transition: 'all 0.1s',
                          }}
                        >
                          {formatTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP: Details */}
          {step === 'details' && selectedSlot && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button type="button" onClick={() => setStep('time')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}>← Back</button>
                <div>
                  <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{selectedDate && formatDateLabel(selectedDate)}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>{formatTime(selectedSlot)}</p>
                </div>
              </div>

              {/* Metric selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>Metrics to test (select all that apply)</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {METRIC_KEYS.map(key => {
                    const selected = selectedMetrics.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleMetric(key)}
                        style={{
                          padding: '0.3rem 0.75rem', borderRadius: '9999px', cursor: 'pointer',
                          border: `1px solid ${selected ? '#e8a020' : '#1e2530'}`,
                          backgroundColor: selected ? 'rgba(232,160,32,0.12)' : 'transparent',
                          color: selected ? '#e8a020' : '#6b7280',
                          fontSize: '0.75rem', fontWeight: selected ? 600 : 400,
                          transition: 'all 0.1s',
                        }}
                      >
                        {METRIC_INFO[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>Notes for the coach (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional information about your goals or what you'd like tested..."
                  rows={3}
                  style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.5rem', color: '#f0f6fc', padding: '0.6rem 0.75rem', fontSize: '0.85rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, fontFamily: 'inherit' }}
                />
              </div>

              {bookingError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>{bookingError}</p>}

              <button
                type="button"
                onClick={handleBook}
                disabled={booking}
                style={{ width: '100%', backgroundColor: booking ? '#374151' : '#e8a020', color: booking ? '#6b7280' : '#000', border: 'none', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: booking ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s' }}
              >
                {booking ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
