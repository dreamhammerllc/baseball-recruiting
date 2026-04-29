'use client';

import { useState } from 'react';
import BookingModal from '@/components/BookingModal';
import { METRIC_INFO, type MetricKey } from '@/lib/metrics';

interface Coach {
  id: string;
  full_name: string;
  email: string;
  title: string;
  organization: string;
  bio: string | null;
  photo_url: string | null;
  distance_miles: number;
  advance_notice_hours: number;
  session_duration_minutes: number;
}

type GpsStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function CoachFinderClient() {
  // GPS state
  const [gpsStatus, setGpsStatus]     = useState<GpsStatus>('idle');
  const [gpsCoords, setGpsCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  // Zip fallback state
  const [zip, setZip]                 = useState('');
  const [showZip, setShowZip]         = useState(false);

  // Shared search state
  const [radius, setRadius]           = useState(25);
  const [coaches, setCoaches]         = useState<Coach[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searched, setSearched]       = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // UI state
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [expandedBio, setExpandedBio]     = useState<string | null>(null);

  // ── GPS ──────────────────────────────────────────────────────────────────────
  function requestGps() {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      setShowZip(true);
      return;
    }
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setGpsStatus('granted');
        setLocationLabel('Current location');
        setShowZip(false);
        runSearch({ coords, r: radius });
      },
      (err) => {
        console.warn('GPS denied:', err.message);
        setGpsStatus('denied');
        setShowZip(true);
        setSearchError('Location access was denied. Enter your zip code below instead.');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  async function runSearch({ coords, zip: z, r }: { coords?: { lat: number; lng: number } | null; zip?: string; r: number }) {
    setSearching(true); setSearchError(null); setSearched(false);
    try {
      let url: string;
      if (coords) {
        url = `/api/coaches/search?lat=${coords.lat}&lng=${coords.lng}&radius=${r}`;
      } else if (z && /^\d{5}$/.test(z)) {
        url = `/api/coaches/search?zip=${z}&radius=${r}`;
      } else {
        setSearchError('Please use your location or enter a valid 5-digit zip code.');
        setSearching(false);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed.');
      setCoaches(data.coaches ?? []);
      setSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed. Please try again.');
    } finally { setSearching(false); }
  }

  function handleZipSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch({ zip, r: radius });
  }

  function handleRadiusChange(r: number) {
    setRadius(r);
    if (gpsCoords) runSearch({ coords: gpsCoords, r });
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.5rem',
    color: '#f0f6fc', padding: '0.6rem 0.75rem', fontSize: '0.9rem', outline: 'none',
  };

  return (
    <>
      {/* ── Location selector ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.75rem' }}>

        {/* GPS primary button */}
        {gpsStatus !== 'granted' && (
          <button
            type="button"
            onClick={requestGps}
            disabled={gpsStatus === 'requesting'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              backgroundColor: gpsStatus === 'requesting' ? '#374151' : '#e8a020',
              color: gpsStatus === 'requesting' ? '#9ca3af' : '#000',
              border: 'none', borderRadius: '0.6rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.95rem', fontWeight: 700,
              cursor: gpsStatus === 'requesting' ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              marginBottom: '1rem',
              width: '100%', maxWidth: '340px',
              justifyContent: 'center',
            }}
          >
            {gpsStatus === 'requesting' ? (
              <>
                <SpinnerIcon />
                Detecting location...
              </>
            ) : (
              <>
                <PinIcon />
                Use My Location
              </>
            )}
          </button>
        )}

        {/* Confirmed GPS location */}
        {gpsStatus === 'granted' && locationLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '0.5rem', padding: '0.55rem 1rem' }}>
              <span style={{ color: '#34d399', fontSize: '0.85rem' }}>📍</span>
              <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>{locationLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => { setGpsStatus('idle'); setGpsCoords(null); setLocationLabel(null); setShowZip(true); setCoaches([]); setSearched(false); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Change
            </button>
          </div>
        )}

        {/* Radius selector — always visible once we have a location */}
        {(gpsStatus === 'granted' || showZip) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>Radius:</span>
            {RADIUS_OPTIONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => handleRadiusChange(r)}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                  backgroundColor: radius === r ? '#e8a020' : '#1e2530',
                  color: radius === r ? '#000' : '#9ca3af',
                  fontSize: '0.8rem', fontWeight: radius === r ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {r} mi
              </button>
            ))}
          </div>
        )}

        {/* Zip fallback — "or" divider + zip form */}
        {!showZip && gpsStatus === 'idle' && (
          <button
            type="button"
            onClick={() => setShowZip(true)}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', display: 'block' }}
          >
            Search by zip code instead
          </button>
        )}

        {showZip && gpsStatus !== 'granted' && (
          <form onSubmit={handleZipSearch}>
            {gpsStatus === 'denied' && (
              <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0 0 0.75rem' }}>
                Enter your zip code to find coaches near you:
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                value={zip}
                onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Zip code"
                maxLength={5}
                style={{ ...inputStyle, width: '130px' }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  backgroundColor: searching ? '#374151' : '#1e2530',
                  color: searching ? '#6b7280' : '#f0f6fc',
                  border: '1px solid #374151', borderRadius: '0.5rem',
                  padding: '0.6rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
                  cursor: searching ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s',
                }}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              {/* Also offer GPS again if they ended up in zip mode from idle */}
              {gpsStatus === 'idle' && (
                <button
                  type="button"
                  onClick={requestGps}
                  style={{ background: 'none', border: 'none', color: '#e8a020', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Use GPS instead
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {searchError && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{searchError}</p>}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {searched && coaches.length === 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px dashed #1e2530', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#f0f6fc', fontWeight: 600, margin: '0 0 0.4rem' }}>No coaches found within {radius} miles</p>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
            Try expanding your radius or check back as more coaches join the platform.
          </p>
        </div>
      )}

      {coaches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.25rem' }}>
            {coaches.length} coach{coaches.length !== 1 ? 'es' : ''} within {radius} miles
          </p>
          {coaches.map(coach => {
            const bioExpanded = expandedBio === coach.id;
            const bioText = coach.bio ?? '';
            const bioTruncated = bioText.length > 160;
            return (
              <div key={coach.id} style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {coach.photo_url
                      ? <img src={coach.photo_url} alt={coach.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '1.1rem' }}>{coach.full_name.charAt(0)}</span>
                    }
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.15rem' }}>{coach.full_name}</p>
                        <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '0 0 0.1rem' }}>{coach.title}</p>
                        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>{coach.organization}</p>
                      </div>
                      <span style={{ backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.25)', color: '#e8a020', borderRadius: '9999px', padding: '0.2rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {coach.distance_miles} mi away
                      </span>
                    </div>
                    <a href={`mailto:${coach.email}`} style={{ color: '#58a6ff', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
                      {coach.email}
                    </a>
                    {bioText && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0, lineHeight: 1.6 }}>
                          {bioExpanded || !bioTruncated ? bioText : `${bioText.slice(0, 160)}...`}
                        </p>
                        {bioTruncated && (
                          <button type="button" onClick={() => setExpandedBio(bioExpanded ? null : coach.id)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem' }}>
                            {bioExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>⏱ {coach.session_duration_minutes} min sessions</span>
                      <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>📅 {coach.advance_notice_hours}hr advance notice</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCoach(coach)}
                      style={{ marginTop: '1rem', backgroundColor: '#e8a020', color: '#000', border: 'none', borderRadius: '0.5rem', padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s' }}
                    >
                      View & Schedule →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCoach && (
        <BookingModal coach={selectedCoach} onClose={() => setSelectedCoach(null)} onBooked={() => setSelectedCoach(null)} />
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
