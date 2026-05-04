'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as tus from 'tus-js-client';
import CoachSidebar from '@/components/layout/CoachSidebar';
import AddAthleteModal from '@/components/AddAthleteModal';
import { METRIC_KEYS, METRIC_INFO, type MetricKey } from '@/lib/metrics';
import type { CoachProfile } from '@/app/api/coach/setup/route';
import type { AthleteSearchResult } from '@/app/api/coach/athletes/search/route';

export default function CoachDashboardClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const today        = new Date().toISOString().split('T')[0];
  const verifyRef    = useRef<HTMLDivElement>(null);

  // Coach profile state
  const [coach, setCoach]                 = useState<CoachProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Athlete search state
  const [searchQuery, setSearchQuery]     = useState('');
  const [searching, setSearching]         = useState(false);
  const [searchResults, setSearchResults] = useState<AthleteSearchResult[] | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteSearchResult | null>(null);

  // Save athlete state
  const [savedIds, setSavedIds]         = useState<Set<string>>(new Set());
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [saveError, setSaveError]       = useState<string | null>(null);

  // Metric form state
  const [metricKey, setMetricKey]         = useState<MetricKey>(METRIC_KEYS[0]);
  const [value, setValue]                 = useState('');
  const [recordedAt, setRecordedAt]       = useState(today);

  // Video upload state
  const [videoFile, setVideoFile]         = useState<File | null>(null);
  const [videoUrl, setVideoUrl]           = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const captureInputRef                   = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitting, setSubmitting]       = useState(false);
  const [result, setResult]               = useState<{ approved: boolean; message: string } | null>(null);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  // Add Athlete modal
  const [showAddModal, setShowAddModal]   = useState(false);

  // Load coach profile
  useEffect(() => {
    fetch('/api/coach/setup')
      .then(r => r.json())
      .then(data => {
        setCoach(data.coach ?? null);
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
  }, []);

  // Auto-select athlete from URL params (e.g. coming from My Athletes page)
  useEffect(() => {
    const athleteId   = searchParams.get('athleteId');
    const athleteName = searchParams.get('athleteName');
    const athletePhoto = searchParams.get('athletePhoto');
    const athleteUsername = searchParams.get('athleteUsername');
    if (athleteId && athleteName) {
      const preSelected: AthleteSearchResult = {
        clerkId:   athleteId,
        fullName:  athleteName,
        firstName: null,
        lastName:  null,
        username:  athleteUsername ?? null,
        photoUrl:  athletePhoto ?? null,
      };
      setSelectedAthlete(preSelected);
      setResult(null);
      setSubmitError(null);
      // Scroll verify form into view after a short delay
      setTimeout(() => {
        verifyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [searchParams]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchResults(null);
    setSelectedAthlete(null);
    setSaveError(null);
    try {
      const res = await fetch(`/api/coach/athletes/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      const users = data.users ?? [];
      setSearchResults(users);
      // Seed already-saved IDs from search results
      const alreadySaved = new Set<string>(users.filter((u: AthleteSearchResult & { isSaved?: boolean }) => u.isSaved).map((u: AthleteSearchResult) => u.clerkId));
      setSavedIds(prev => new Set([...prev, ...alreadySaved]));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveAthlete(athlete: AthleteSearchResult & { isSaved?: boolean }) {
    setSavingId(athlete.clerkId);
    setSaveError(null);
    try {
      const res = await fetch('/api/coach/saved-athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_clerk_id: athlete.clerkId,
          athlete_name:     athlete.fullName,
          athlete_photo:    athlete.photoUrl ?? null,
          athlete_username: athlete.username ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save.'); return; }
      setSavedIds(prev => new Set([...prev, athlete.clerkId]));
    } catch { setSaveError('Failed to save athlete.'); }
    finally { setSavingId(null); }
  }

  function handleSelectAthlete(athlete: AthleteSearchResult) {
    setSelectedAthlete(athlete);
    setResult(null);
    setSubmitError(null);
    setValue('');
    setVideoFile(null);
    setVideoUrl(null);
    setUploadError(null);
    setMetricKey(METRIC_KEYS[0]);
    setRecordedAt(today);
  }

  async function handleVideoUpload() {
    if (!videoFile || !selectedAthlete) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      // Step 1: Get TUS credentials from server
      const tokenRes = await fetch('/api/upload-video/stream-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename:   videoFile.name,
          uploadType: 'coach_verification',
          metricKey,
          slotNumber: null,
        }),
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok || token.error) throw new Error(token.error ?? 'Failed to get upload token.');

      const { videoId, libraryId, expirationTime, signature, cdnUrl } = token;

      // Step 2: Upload directly to Bunny Stream via TUS
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(videoFile, {
          endpoint:    'https://video.bunnycdn.com/tusupload',
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire:    String(expirationTime),
            VideoId:                videoId,
            LibraryId:              String(libraryId),
          },
          metadata: {
            filetype: videoFile.type,
            title:    videoFile.name,
          },
          onProgress(bytesUploaded, bytesTotal) {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess() { resolve(); },
          onError(err) { reject(err); },
        });
        upload.start();
      });

      setVideoUrl(cdnUrl);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAthlete) return;
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setSubmitError('Please enter a valid positive number.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const res = await fetch('/api/coach/verify-metric', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          athleteClerkId: selectedAthlete.clerkId,
          metricKey,
          value:          numVal,
          videoUrl:       videoUrl ?? null,
          recordedAt:     recordedAt ? new Date(recordedAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verification failed.');
      setResult({
        approved: data.status === 'approved',
        message:  data.status === 'approved'
          ? `Metric verified and saved to ${selectedAthlete.fullName}'s profile.`
          : 'Verification submitted for manual review.',
      });
      setValue('');
      setVideoFile(null);
      setVideoUrl(null);
      setRecordedAt(today);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: '0.5rem',
    color: '#f0f6fc',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'block',
    marginBottom: '0.4rem',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111827',
    border: '1px solid #1e2530',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <CoachSidebar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading...</p>
        </main>
      </div>
    );
  }

  // ── No profile ────────────────────────────────────────────────────────────
  if (!coach) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <CoachSidebar />
        <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
          <div style={{ ...cardStyle, maxWidth: '480px' }}>
            <h2 style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
              Complete Your Profile
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
              Set up your coach profile before verifying athlete metrics.
            </p>
            <button
              onClick={() => router.push('/dashboard/coach/setup')}
              style={{
                backgroundColor: '#e8a020',
                color: '#000000',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.65rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set Up Profile
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Full dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', maxWidth: '860px' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.2rem', letterSpacing: '-0.02em' }}>
              Coach Dashboard
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              {coach.title} &mdash; {coach.organization}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              backgroundColor: '#e8a020', color: '#000000', fontWeight: 700,
              fontSize: '0.875rem', padding: '0.6rem 1.25rem', borderRadius: '0.5rem',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            + Add Athlete
          </button>
        </div>

        {showAddModal && (
          <AddAthleteModal
            onClose={() => setShowAddModal(false)}
            onConnected={() => {
              setShowAddModal(false);
              router.push('/dashboard/coach/athletes');
            }}
          />
        )}

        {/* Athlete Search */}
        <div style={cardStyle}>
          <h2 style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem' }}>
            Find Athlete
          </h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Search by name or username</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type athlete name..."
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={searching || searchQuery.trim().length < 2}
              style={{
                backgroundColor: searching || searchQuery.trim().length < 2 ? '#374151' : '#e8a020',
                color:           searching || searchQuery.trim().length < 2 ? '#6b7280' : '#000000',
                border:          'none',
                borderRadius:    '0.5rem',
                padding:         '0.6rem 1.25rem',
                fontSize:        '0.875rem',
                fontWeight:      700,
                cursor:          searching || searchQuery.trim().length < 2 ? 'not-allowed' : 'pointer',
                whiteSpace:      'nowrap',
                transition:      'background-color 0.15s',
              }}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Search results */}
          {searchResults !== null && (
            <div style={{ marginTop: '1rem' }}>
              {searchResults.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No athletes found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {saveError && (
                    <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 0.25rem' }}>{saveError}</p>
                  )}
                  {searchResults.map(athlete => {
                    const isSaved = savedIds.has(athlete.clerkId);
                    const isSaving = savingId === athlete.clerkId;
                    return (
                      <div
                        key={athlete.clerkId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          backgroundColor: selectedAthlete?.clerkId === athlete.clerkId ? 'rgba(232,160,32,0.08)' : '#0d1117',
                          border: selectedAthlete?.clerkId === athlete.clerkId ? '1px solid rgba(232,160,32,0.3)' : '1px solid #1e2530',
                          borderRadius: '0.5rem', padding: '0.65rem 0.85rem',
                          transition: 'border-color 0.15s, background-color 0.15s',
                        }}
                      >
                        {/* Avatar */}
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {athlete.photoUrl
                            ? <img src={athlete.photoUrl} alt={athlete.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: '#e8a020', fontWeight: 700, fontSize: '0.85rem' }}>{athlete.fullName.charAt(0)}</span>
                          }
                        </div>
                        {/* Name — clickable to select for verification */}
                        <button
                          type="button"
                          onClick={() => handleSelectAthlete(athlete)}
                          style={{ flex: 1, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                        >
                          <span style={{ color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{athlete.fullName}</span>
                          {athlete.username && (
                            <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>@{athlete.username}</span>
                          )}
                        </button>
                        {/* Save button */}
                        <button
                          type="button"
                          onClick={() => !isSaved && handleSaveAthlete(athlete)}
                          disabled={isSaving || isSaved}
                          style={{
                            flexShrink: 0,
                            backgroundColor: isSaved ? 'rgba(52,211,153,0.1)' : 'rgba(232,160,32,0.1)',
                            border: `1px solid ${isSaved ? 'rgba(52,211,153,0.3)' : 'rgba(232,160,32,0.3)'}`,
                            borderRadius: '0.4rem',
                            color: isSaved ? '#34d399' : '#e8a020',
                            cursor: isSaved ? 'default' : 'pointer',
                            fontSize: '0.75rem', fontWeight: 700,
                            padding: '0.3rem 0.75rem',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isSaving ? 'Saving...' : isSaved ? '✓ Saved' : '+ Save'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Verify Metric Form */}
        {selectedAthlete && !result && (
          <div ref={verifyRef} style={cardStyle}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.2rem' }}>
                Verify Metric
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
                Recording for {selectedAthlete.fullName}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Metric picker */}
              <div>
                <label style={labelStyle}>Metric</label>
                <select
                  value={metricKey}
                  onChange={e => {
                    setMetricKey(e.target.value as MetricKey);
                    setVideoFile(null);
                    setVideoUrl(null);
                    setUploadError(null);
                  }}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                >
                  {METRIC_KEYS.map(k => (
                    <option key={k} value={k}>
                      {METRIC_INFO[k].label} ({METRIC_INFO[k].unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label style={labelStyle}>
                  Value ({METRIC_INFO[metricKey].unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={`Enter ${METRIC_INFO[metricKey].label.toLowerCase()}...`}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Date */}
              <div>
                <label style={labelStyle}>Date Observed</label>
                <input
                  type="date"
                  value={recordedAt}
                  onChange={e => setRecordedAt(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Video upload */}
              <div>
                <label style={labelStyle}>
                  Video Clip (optional &mdash; recommended 90 seconds or less)
                </label>
                {/* Hidden file picker — existing files */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setVideoFile(f);
                    setVideoUrl(null);
                    setUploadError(null);
                  }}
                />
                {/* Hidden file picker — native camera capture */}
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setVideoFile(f);
                    setVideoUrl(null);
                    setUploadError(null);
                  }}
                />
                {!videoUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Pick / record buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #1e2530',
                          color: '#9ca3af',
                          borderRadius: '0.5rem',
                          padding: '0.5rem 1rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
                          (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2530';
                          (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                        }}
                      >
                        Choose Video
                      </button>
                      <button
                        type="button"
                        onClick={() => captureInputRef.current?.click()}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid #1e2530',
                          color: '#9ca3af',
                          borderRadius: '0.5rem',
                          padding: '0.5rem 1rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, color 0.15s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
                          (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2530';
                          (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                        </svg>
                        Record Video
                      </button>
                    </div>
                    {/* Selected file status */}
                    {videoFile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {videoFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleVideoUpload}
                          disabled={uploading}
                          style={{
                            backgroundColor: uploading ? '#374151' : 'rgba(88,166,255,0.12)',
                            border: '1px solid rgba(88,166,255,0.3)',
                            color: uploading ? '#6b7280' : '#58a6ff',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.875rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: uploading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {uploading ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Uploading...') : 'Upload'}
                        </button>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={() => { setVideoFile(null); setUploadError(null); }}
                            style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 600 }}>
                      &#10003; Video uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => { setVideoFile(null); setVideoUrl(null); }}
                      style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {uploadError && (
                  <p style={{ color: '#f87171', fontSize: '0.78rem', margin: '0.4rem 0 0' }}>{uploadError}</p>
                )}
              </div>

              {/* Error + submit */}
              {submitError && (
                <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{submitError}</p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  style={{
                    backgroundColor: submitting || uploading ? '#374151' : '#e8a020',
                    color:           submitting || uploading ? '#6b7280' : '#000000',
                    border:          'none',
                    borderRadius:    '0.5rem',
                    padding:         '0.65rem 1.5rem',
                    fontSize:        '0.9rem',
                    fontWeight:      700,
                    cursor:          submitting || uploading ? 'not-allowed' : 'pointer',
                    transition:      'background-color 0.15s',
                  }}
                >
                  {submitting ? 'Verifying...' : 'Verify Metric'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedAthlete(null); setSearchResults(null); setSearchQuery(''); }}
                  style={{
                    backgroundColor: 'transparent',
                    border:          '1px solid #1e2530',
                    color:           '#6b7280',
                    borderRadius:    '0.5rem',
                    padding:         '0.65rem 1rem',
                    fontSize:        '0.875rem',
                    cursor:          'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Result */}
        {result && selectedAthlete && (
          <div style={{
            ...cardStyle,
            border: result.approved ? '1px solid rgba(74,222,128,0.3)' : '1px solid #1e2530',
            backgroundColor: result.approved ? 'rgba(74,222,128,0.04)' : '#111827',
          }}>
            <p style={{
              color: result.approved ? '#4ade80' : '#e8a020',
              fontWeight: 700,
              fontSize: '0.95rem',
              margin: '0 0 0.4rem',
            }}>
              {result.approved ? 'Verification Approved' : 'Verification Submitted'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
              {result.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setResult(null); setValue(''); setRecordedAt(today); setVideoFile(null); setVideoUrl(null); }}
                style={{
                  backgroundColor: '#e8a020',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Verify Another Metric
              </button>
              <button
                onClick={() => { setSelectedAthlete(null); setResult(null); setSearchResults(null); setSearchQuery(''); }}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #1e2530',
                  color: '#6b7280',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Find Another Athlete
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
