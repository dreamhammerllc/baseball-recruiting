'use client';

import { useState, useEffect, useCallback } from 'react';
import CoachSidebar from '@/components/layout/CoachSidebar';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NOTICE_OPTIONS = [
  { value: 4,  label: '4 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
];
const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '90 minutes' },
];

interface Window { day_of_week: number; start_time: string; end_time: string; }

const defaultWindow = (day: number): Window => ({ day_of_week: day, start_time: '09:00', end_time: '17:00' });

export default function CoachAvailabilityPage() {
  const [windows, setWindows]             = useState<Window[]>([]);
  const [advanceNotice, setAdvanceNotice] = useState(24);
  const [duration, setDuration]           = useState(60);
  const [accepting, setAccepting]         = useState(true);
  const [icalSecret, setIcalSecret]       = useState('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

  // Location state
  const [hasLocation, setHasLocation]         = useState(false);
  const [locationLabel, setLocationLabel]     = useState<string | null>(null);
  const [locationZip, setLocationZip]         = useState<string | null>(null);
  const [gpsStatus, setGpsStatus]             = useState<'idle'|'requesting'|'saved'>('idle');
  const [locationSaving, setLocationSaving]   = useState(false);
  const [locationError, setLocationError]     = useState<string | null>(null);
  const [showZipInput, setShowZipInput]       = useState(false);
  const [zipInput, setZipInput]               = useState('');
  const [locationSaved, setLocationSaved]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [availRes, locRes] = await Promise.all([
        fetch('/api/coach/availability'),
        fetch('/api/coach/location'),
      ]);
      if (availRes.ok) {
        const { windows: w, settings: s } = await availRes.json();
        setWindows(w ?? []);
        setAdvanceNotice(s.advance_notice_hours ?? 24);
        setDuration(s.session_duration_minutes ?? 60);
        setAccepting(s.is_accepting_bookings ?? true);
        setIcalSecret(s.ical_secret ?? '');
      }
      if (locRes.ok) {
        const loc = await locRes.json();
        setHasLocation(loc.has_location ?? false);
        setLocationLabel(loc.location_label ?? null);
        setLocationZip(loc.zip_code ?? null);
        if (loc.has_location) setGpsStatus('saved');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function isActive(day: number) { return windows.some(w => w.day_of_week === day); }

  function toggleDay(day: number) {
    if (isActive(day)) {
      setWindows(prev => prev.filter(w => w.day_of_week !== day));
    } else {
      setWindows(prev => [...prev, defaultWindow(day)].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  }

  function updateWindow(day: number, field: 'start_time' | 'end_time', val: string) {
    setWindows(prev => prev.map(w => w.day_of_week === day ? { ...w, [field]: val } : w));
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/coach/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windows, advance_notice_hours: advanceNotice, session_duration_minutes: duration, is_accepting_bookings: accepting }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error saving.');
    } finally { setSaving(false); }
  }

  async function copyIcal() {
    const url = `${window.location.origin}/api/ical/${icalSecret}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Location helpers ────────────────────────────────────────────────────────
  async function saveLocation(body: { lat?: number; lng?: number; zip?: string }) {
    setLocationSaving(true); setLocationError(null); setLocationSaved(false);
    try {
      const res = await fetch('/api/coach/location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save.');
      setHasLocation(true);
      setGpsStatus('saved');
      setLocationLabel(data.location_label ?? null);
      setLocationZip(data.zip_code ?? null);
      setShowZipInput(false);
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 3000);
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : 'Error saving location.');
    } finally { setLocationSaving(false); }
  }

  function requestGps() {
    if (!navigator.geolocation) { setShowZipInput(true); return; }
    setGpsStatus('requesting'); setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn('GPS denied:', err.message);
        setGpsStatus('idle');
        setLocationError('Location access denied. Enter your zip code instead.');
        setShowZipInput(true);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  function handleZipSave(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zipInput)) { setLocationError('Enter a valid 5-digit zip code.'); return; }
    saveLocation({ zip: zipInput });
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.4rem',
    color: '#f0f6fc', padding: '0.45rem 0.6rem', fontSize: '0.85rem', outline: 'none',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '1.5rem' };

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
        <div style={{ maxWidth: '680px' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
              Availability Settings
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Set when athletes can book testing sessions with you.
            </p>
          </div>

          {/* ── Discovery Location ──────────────────────────────────────── */}
          <div style={{ backgroundColor: '#111827', border: `1px solid ${hasLocation ? 'rgba(52,211,153,0.3)' : '#1e2530'}`, borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Discovery Location</p>
              {hasLocation && (
                <span style={{ backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', borderRadius: '9999px', padding: '0.15rem 0.65rem', fontSize: '0.7rem', fontWeight: 600 }}>Active</span>
              )}
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
              Your location is used so athletes can find you by mile radius. Only your approximate area is used — your exact coordinates are never shown.
            </p>

            {/* Current saved location */}
            {hasLocation && gpsStatus === 'saved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '0.5rem', padding: '0.45rem 0.9rem' }}>
                  <span style={{ color: '#34d399' }}>📍</span>
                  <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
                    {locationLabel ?? locationZip ?? 'Location saved'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setGpsStatus('idle'); setHasLocation(false); setShowZipInput(false); setLocationLabel(null); setLocationZip(null); }}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Update
                </button>
              </div>
            )}

            {/* GPS button — shown when no location saved or updating */}
            {(!hasLocation || gpsStatus === 'idle') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={requestGps}
                  disabled={locationSaving || gpsStatus === 'requesting'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                    backgroundColor: (locationSaving || gpsStatus === 'requesting') ? '#374151' : '#e8a020',
                    color: (locationSaving || gpsStatus === 'requesting') ? '#6b7280' : '#000',
                    border: 'none', borderRadius: '0.5rem', padding: '0.65rem 1.25rem',
                    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s',
                    width: 'fit-content',
                  }}
                >
                  {gpsStatus === 'requesting' || locationSaving ? (
                    <><SpinnerIcon /> Detecting location...</>
                  ) : (
                    <><PinIcon /> Use My Location</>
                  )}
                </button>

                {/* Zip fallback */}
                {!showZipInput && gpsStatus !== 'requesting' && (
                  <button type="button" onClick={() => setShowZipInput(true)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', width: 'fit-content', padding: 0 }}>
                    Set by zip code instead
                  </button>
                )}

                {showZipInput && (
                  <form onSubmit={handleZipSave} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={zipInput}
                      onChange={e => setZipInput(e.target.value.replace(/\D/g,'').slice(0,5))}
                      placeholder="Zip code"
                      maxLength={5}
                      style={{ backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.4rem', color: '#f0f6fc', padding: '0.45rem 0.6rem', fontSize: '0.85rem', outline: 'none', width: '120px' }}
                    />
                    <button type="submit" disabled={locationSaving} style={{ backgroundColor: '#374151', color: '#f0f6fc', border: 'none', borderRadius: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      {locationSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setShowZipInput(false); setLocationError(null); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
                  </form>
                )}
              </div>
            )}

            {locationError && <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{locationError}</p>}
            {locationSaved && <p style={{ color: '#34d399', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>✓ Location saved. Athletes can now find you.</p>}
          </div>

          {/* Accepting bookings toggle */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <p style={{ color: '#f0f6fc', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.2rem' }}>Accepting Bookings</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>When off, athletes cannot schedule sessions with you.</p>
            </div>
            <button
              type="button"
              onClick={() => setAccepting(p => !p)}
              style={{
                width: '48px', height: '26px', borderRadius: '9999px', border: 'none', cursor: 'pointer', flexShrink: 0,
                backgroundColor: accepting ? '#e8a020' : '#374151', position: 'relative', transition: 'background-color 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: '#ffffff', transition: 'left 0.2s', left: accepting ? '25px' : '3px',
              }} />
            </button>
          </div>

          {/* Session settings */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>Session Settings</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>Session Duration</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ ...selectStyle, width: '100%' }}>
                  {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>Advance Notice Required</label>
                <select value={advanceNotice} onChange={e => setAdvanceNotice(Number(e.target.value))} style={{ ...selectStyle, width: '100%' }}>
                  {NOTICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Weekly availability */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>Weekly Availability</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {DAYS.map((day, idx) => {
                const active = isActive(idx);
                const win = windows.find(w => w.day_of_week === idx);
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Day toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDay(idx)}
                      style={{
                        width: '100px', padding: '0.4rem 0', borderRadius: '0.4rem', border: 'none', cursor: 'pointer', flexShrink: 0,
                        backgroundColor: active ? 'rgba(232,160,32,0.12)' : '#1e2530',
                        color: active ? '#e8a020' : '#6b7280',
                        fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                    {/* Time inputs */}
                    {active && win && (
                      <>
                        <input type="time" value={win.start_time} onChange={e => updateWindow(idx, 'start_time', e.target.value)} style={inputStyle} />
                        <span style={{ color: '#4b5563', fontSize: '0.8rem' }}>to</span>
                        <input type="time" value={win.end_time} onChange={e => updateWindow(idx, 'end_time', e.target.value)} style={inputStyle} />
                      </>
                    )}
                    {!active && (
                      <span style={{ color: '#374151', fontSize: '0.8rem' }}>Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* iCal link */}
          {icalSecret && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>Calendar Sync (iCal)</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
                Copy this link and paste it into Google Calendar or Apple Calendar to automatically sync all your bookings.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #1e2530', borderRadius: '0.4rem', padding: '0.45rem 0.75rem', fontSize: '0.75rem', color: '#9ca3af', overflowX: 'auto', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/ical/${icalSecret}` : `/api/ical/${icalSecret}`}
                </code>
                <button type="button" onClick={copyIcal} style={{ backgroundColor: copied ? '#34d399' : '#374151', color: copied ? '#000' : '#f0f6fc', border: 'none', borderRadius: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s' }}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* Error / Success */}
          {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
          {saved && <p style={{ color: '#34d399', fontSize: '0.875rem', marginBottom: '1rem' }}>✓ Availability saved successfully.</p>}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: saving ? '#374151' : '#e8a020', color: saving ? '#6b7280' : '#000', border: 'none', borderRadius: '0.5rem', padding: '0.65rem 2rem', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s' }}
          >
            {saving ? 'Saving...' : 'Save Availability'}
          </button>

        </div>
      </main>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
