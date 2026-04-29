'use client';

import { useState } from 'react';
import BookingModal from '@/components/BookingModal';
import { METRIC_INFO, METRIC_KEYS, type MetricKey } from '@/lib/metrics';

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

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function CoachFinderClient() {
  const [zip, setZip]               = useState('');
  const [radius, setRadius]         = useState(25);
  const [coaches, setCoaches]       = useState<Coach[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [expandedBio, setExpandedBio] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) { setSearchError('Please enter a valid 5-digit zip code.'); return; }
    setSearching(true); setSearchError(null); setSearched(false);
    try {
      const res = await fetch(`/api/coaches/search?zip=${zip}&radius=${radius}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed.');
      setCoaches(data.coaches ?? []);
      setSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed.');
    } finally { setSearching(false); }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.5rem',
    color: '#f0f6fc', padding: '0.6rem 0.75rem', fontSize: '0.9rem', outline: 'none',
  };

  return (
    <>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <input
          type="text"
          value={zip}
          onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="Your zip code"
          maxLength={5}
          style={{ ...inputStyle, width: '160px' }}
        />
        <select
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
          style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: '1.5rem' }}
        >
          {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} miles</option>)}
        </select>
        <button
          type="submit"
          disabled={searching}
          style={{
            backgroundColor: searching ? '#374151' : '#e8a020',
            color: searching ? '#6b7280' : '#000',
            border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem',
            fontSize: '0.9rem', fontWeight: 700, cursor: searching ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {searching ? 'Searching...' : 'Find Coaches'}
        </button>
      </form>

      {searchError && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{searchError}</p>}

      {/* Results */}
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
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
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

                    {/* Email */}
                    <a href={`mailto:${coach.email}`} style={{ color: '#58a6ff', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
                      {coach.email}
                    </a>

                    {/* Bio */}
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

                    {/* Session info */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>⏱ {coach.session_duration_minutes} min sessions</span>
                      <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>📅 {coach.advance_notice_hours}hr advance notice</span>
                    </div>

                    {/* Action */}
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

      {/* Booking modal */}
      {selectedCoach && (
        <BookingModal
          coach={selectedCoach}
          onClose={() => setSelectedCoach(null)}
          onBooked={() => { setSelectedCoach(null); }}
        />
      )}
    </>
  );
}
