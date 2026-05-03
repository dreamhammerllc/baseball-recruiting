'use client';

import { useState, useMemo } from 'react';
import MetricCard from '@/components/MetricCard';
import MetricsGraph from '@/components/MetricsGraph';
import VideoUpload from '@/components/VideoUpload';
import ThirdPartyImportModal from '@/components/ThirdPartyImportModal';
import CoachVerificationModal from '@/components/CoachVerificationModal';
import { getMetricsForPositions, METRIC_INFO, POSITIONS } from '@/lib/metrics';
import type {
  AthleteMetric,
  AthletePosition,
  HighlightVideo,
  MetricKey,
  Position,
} from '@/lib/metrics';

interface Props {
  athleteClerkId: string;
  position: AthletePosition | null;
  allMetrics: AthleteMetric[];
  highlights: HighlightVideo[];
  highlightSlotLimit: number;
}

// ─── Position Setup ───────────────────────────────────────────────────────────

function PositionSetup({
  athleteClerkId,
  onSaved,
}: {
  athleteClerkId: string;
  onSaved: (pos: AthletePosition) => void;
}) {
  const [primary, setPrimary] = useState<string>('');
  const [secondary, setSecondary] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!primary) { setError('Primary position is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/athlete-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteClerkId,
          primaryPosition: primary,
          secondaryPosition: secondary || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save position.');
      }
      onSaved({
        athlete_clerk_id: athleteClerkId,
        primary_position: primary as Position,
        secondary_position: (secondary || null) as Position | null,
        updated_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSaving(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: '0.5rem',
    color: '#f0f6fc',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    appearance: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{
      backgroundColor: '#111827',
      border: '1px solid #1e2530',
      borderRadius: '0.75rem',
      padding: '2rem',
      maxWidth: '480px',
    }}>
      <h2 style={{ color: '#f0f6fc', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
        Set Your Positions
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Choose your primary position so we can show the right metrics for your recruiting profile.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
            Primary Position *
          </label>
          <select value={primary} onChange={e => setPrimary(e.target.value)} style={selectStyle} required>
            <option value="">Select position...</option>
            {POSITIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
            Secondary Position (optional)
          </label>
          <select value={secondary} onChange={e => setSecondary(e.target.value)} style={selectStyle}>
            <option value="">None</option>
            {POSITIONS.filter(p => p !== primary).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={saving || !primary}
          style={{
            backgroundColor: saving || !primary ? '#374151' : '#e8a020',
            color: saving || !primary ? '#6b7280' : '#000000',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.65rem 1.5rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: saving || !primary ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s',
            width: 'fit-content',
          }}
        >
          {saving ? 'Saving...' : 'Save Positions'}
        </button>
      </form>
    </div>
  );
}

// ─── Highlight Video Slot ─────────────────────────────────────────────────────

function HighlightSlot({
  slot,
  video,
  onUpload,
  onDelete,
}: {
  slot: number;
  video: HighlightVideo | null;
  onUpload: (slot: number) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!video) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/highlight-videos/${video.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDelete(video.id);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  if (video) {
    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.2rem' }}>
              Slot {slot}
            </span>
            <span style={{ color: '#f0f6fc', fontSize: '0.95rem', fontWeight: 600 }}>
              {video.title ?? 'Highlight Video'}
            </span>
          </div>
          <span style={{
            backgroundColor: 'rgba(88,166,255,0.12)',
            border: '1px solid rgba(88,166,255,0.3)',
            color: '#58a6ff',
            borderRadius: '9999px',
            padding: '0.15rem 0.6rem',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}>
            Active
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: 'transparent',
              border: '1px solid rgba(88,166,255,0.4)',
              color: '#58a6ff',
              borderRadius: '0.4rem',
              padding: '0.3rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Watch
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#ef4444',
              borderRadius: '0.4rem',
              padding: '0.3rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? 'Removing...' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onUpload(slot)}
      style={{
        backgroundColor: '#111827',
        border: '2px dashed #1e2530',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        width: '100%',
        minHeight: '120px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2530'; }}
    >
      <span style={{ color: '#6b7280', fontSize: '1.5rem', lineHeight: 1 }}>+</span>
      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Slot {slot} - Upload Video</span>
    </button>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function MetricsDashboardClient({
  athleteClerkId,
  position: initialPosition,
  allMetrics: initialMetrics,
  highlights: initialHighlights,
  highlightSlotLimit,
}: Props) {
  const [currentPosition, setCurrentPosition] = useState<AthletePosition | null>(initialPosition);
  const [metrics, setMetrics] = useState<AthleteMetric[]>(initialMetrics);
  const [graphMetricKey, setGraphMetricKey] = useState<MetricKey | null>(null);
  const [videoUploadMetricKey, setVideoUploadMetricKey] = useState<MetricKey | null>(null);
  const [highlights, setHighlights] = useState<HighlightVideo[]>(initialHighlights);
  const [highlightUploadSlot, setHighlightUploadSlot] = useState<number | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [metricUploadPhase, setMetricUploadPhase] = useState<'upload' | 'value'>('upload');
  const [metricValueInput, setMetricValueInput] = useState('');
  const [metricValueSaving, setMetricValueSaving] = useState(false);
  const [metricValueError, setMetricValueError] = useState<string | null>(null);
  const [watchVideoMetricKey, setWatchVideoMetricKey]             = useState<MetricKey | null>(null);
  const [showImportModal, setShowImportModal]                     = useState(false);
  const [coachVerificationMetricKey, setCoachVerificationMetricKey] = useState<MetricKey | null>(null);

  const metricKeys = useMemo(
    () =>
      currentPosition
        ? getMetricsForPositions(
            currentPosition.primary_position as Position,
            currentPosition.secondary_position as Position | null | undefined,
          )
        : [],
    [currentPosition],
  );

  function openMetricUploadModal(key: MetricKey) {
    setMetricUploadPhase('upload');
    setMetricValueInput('');
    setMetricValueError(null);
    setVideoUploadError(null);
    setVideoUploadMetricKey(key);
  }

  function openMetricValueModal(key: MetricKey) {
    setMetricUploadPhase('value');
    setMetricValueInput('');
    setMetricValueError(null);
    setVideoUploadError(null);
    setVideoUploadMetricKey(key);
  }

  function closeMetricUploadModal() {
    setVideoUploadMetricKey(null);
    setMetricUploadPhase('upload');
    setMetricValueInput('');
    setMetricValueError(null);
    setVideoUploadError(null);
  }

  function openWatchVideoModal(key: MetricKey) {
    setWatchVideoMetricKey(key);
  }

  function closeWatchVideoModal() {
    setWatchVideoMetricKey(null);
  }

  function handleImportComplete(savedMetrics: AthleteMetric[]) {
    setMetrics(prev => {
      let updated = [...prev];
      for (const newMetric of savedMetrics) {
        if (newMetric.is_personal_best) {
          updated = updated.map(m =>
            m.metric_key === newMetric.metric_key && m.is_personal_best && m.id !== newMetric.id
              ? { ...m, is_personal_best: false }
              : m,
          );
        }
        updated.push(newMetric);
      }
      return updated;
    });
    setShowImportModal(false);
  }

  function getPersonalBest(key: MetricKey): AthleteMetric | null {
    return metrics.find(m => m.metric_key === key && m.is_personal_best) ?? null;
  }

  function getAllEntries(key: MetricKey): AthleteMetric[] {
    return metrics.filter(m => m.metric_key === key);
  }

  function handleVideoUploaded(metricKey: MetricKey, videoUrl: string) {
    const hadPB = metrics.some(m => m.metric_key === metricKey && m.is_personal_best);
    setMetrics(prev => {
      if (hadPB) {
        return prev.map(m =>
          m.metric_key === metricKey && m.is_personal_best ? { ...m, video_url: videoUrl } : m,
        );
      }
      const placeholder: AthleteMetric = {
        id:                `temp-${Date.now()}`,
        athlete_clerk_id:  athleteClerkId,
        metric_key:        metricKey,
        value:             0,
        unit:              METRIC_INFO[metricKey].unit,
        verification_type: 'self_reported',
        is_personal_best:  true,
        video_url:         videoUrl,
        source_label:      null,
        ai_confidence:     null,
        session_id:        null,
        recorded_at:       new Date().toISOString(),
        created_at:        new Date().toISOString(),
      };
      return [...prev, placeholder];
    });

    // Persist video URL to Supabase in the background
    fetch('/api/save-video-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metricKey, videoUrl, athleteClerkId }),
    }).then(res => {
      if (!res.ok) res.json().then(d => console.error('[save-video-url] Error:', d)).catch(() => {});
    }).catch(err => console.error('[save-video-url] Fetch failed:', err));

    if (hadPB) {
      closeMetricUploadModal();
    } else {
      // No prior PB — server created a value=0 placeholder. Prompt for real value.
      setMetricUploadPhase('value');
    }
  }

  async function handleMetricValueSave() {
    if (!videoUploadMetricKey) return;
    const numVal = parseFloat(metricValueInput);
    if (isNaN(numVal) || numVal <= 0) {
      setMetricValueError('Please enter a valid positive number.');
      return;
    }
    setMetricValueSaving(true);
    setMetricValueError(null);
    try {
      const res = await fetch('/api/metrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric_key: videoUploadMetricKey, value: numVal }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to save.');
      setMetrics(prev => prev.map(m =>
        m.metric_key === videoUploadMetricKey && m.is_personal_best ? { ...m, value: numVal } : m,
      ));
      closeMetricUploadModal();
    } catch (err) {
      setMetricValueError(err instanceof Error ? err.message : 'Failed to save value.');
    } finally {
      setMetricValueSaving(false);
    }
  }

  function handleHighlightUploaded(videoUrl: string, slot: number, title?: string) {
    const newHighlight: HighlightVideo = {
      id: `temp-${Date.now()}`,
      athlete_clerk_id: athleteClerkId,
      slot_number: slot,
      video_url: videoUrl,
      title: title ?? null,
      uploaded_at: new Date().toISOString(),
    };
    setHighlights(prev => {
      const filtered = prev.filter(h => h.slot_number !== slot);
      return [...filtered, newHighlight].sort((a, b) => a.slot_number - b.slot_number);
    });
    setHighlightUploadSlot(null);
  }

  function handleHighlightDeleted(id: string) {
    setHighlights(prev => prev.filter(h => h.id !== id));
  }

  // ── UNIVERSAL / PITCHING / THROWING grouping ──────────────────────────────
  const UNIVERSAL: MetricKey[] = ['sixty_yard_dash', 'vertical_jump', 'bat_speed'];
  const HITTING:  MetricKey[] = ['exit_velocity', 'launch_angle', 'distance'];
  const PITCHING: MetricKey[] = [
    'fastball_velocity', 'curveball_velocity', 'slider_velocity', 'changeup_velocity',
    'spin_rate', 'vertical_break', 'horizontal_break',
  ];
  const THROWING: MetricKey[] = ['pop_time', 'catcher_throwing_velocity', 'infield_throwing_velocity', 'outfield_throwing_velocity'];

  const universalKeys = metricKeys.filter(k => UNIVERSAL.includes(k));
  const hittingKeys  = metricKeys.filter(k => HITTING.includes(k));
  const pitchingKeys = metricKeys.filter(k => PITCHING.includes(k));
  const throwingKeys = metricKeys.filter(k => THROWING.includes(k));

  const groupStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const groupHeaderStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #1e2530',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '1rem',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  };

  // ── No position set ───────────────────────────────────────────────────────
  if (!currentPosition) {
    return (
      <PositionSetup athleteClerkId={athleteClerkId} onSaved={setCurrentPosition} />
    );
  }

  const usedSlots = highlights.length;
  const posLabel = currentPosition.secondary_position
    ? `${currentPosition.primary_position} / ${currentPosition.secondary_position}`
    : currentPosition.primary_position;

  return (
    <>
      {/* Position badge + edit link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{
          backgroundColor: 'rgba(232,160,32,0.12)',
          border: '1px solid rgba(232,160,32,0.3)',
          color: '#e8a020',
          borderRadius: '9999px',
          padding: '0.2rem 0.8rem',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}>
          {posLabel}
        </span>
        <button
          onClick={() => setCurrentPosition(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Change positions
        </button>
      </div>

      {/* Import Data button */}
      <div style={{ marginBottom: '1.75rem' }}>
        <button
          onClick={() => setShowImportModal(true)}
          style={{
            background:   'transparent',
            border:       '1px solid rgba(88,166,255,0.4)',
            color:        '#58a6ff',
            borderRadius: '0.5rem',
            padding:      '0.5rem 1.25rem',
            fontSize:     '0.875rem',
            fontWeight:   600,
            cursor:       'pointer',
            transition:   'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background    = 'rgba(88,166,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.borderColor   = '#58a6ff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background    = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor   = 'rgba(88,166,255,0.4)';
          }}
        >
          Import Data
        </button>
      </div>

      {/* Universal metrics */}
      {universalKeys.length > 0 && (
        <div style={groupStyle}>
          <p style={groupHeaderStyle}>Universal</p>
          <div style={gridStyle}>
            {universalKeys.map(key => (
              <MetricCard
                key={key}
                metricKey={key}
                personalBest={getPersonalBest(key)}
                allEntries={getAllEntries(key)}
                onShowGraph={setGraphMetricKey}
                onUploadVideo={openMetricUploadModal}
                onEnterValue={openMetricValueModal}
                onWatchVideo={openWatchVideoModal}
                onViewCoachVerification={setCoachVerificationMetricKey}
                showUploadControls
              />
            ))}
          </div>
        </div>
      )}

      {/* Hitting metrics */}
      {hittingKeys.length > 0 && (
        <div style={groupStyle}>
          <p style={groupHeaderStyle}>Hitting</p>
          <div style={gridStyle}>
            {hittingKeys.map(key => (
              <MetricCard
                key={key}
                metricKey={key}
                personalBest={getPersonalBest(key)}
                allEntries={getAllEntries(key)}
                onShowGraph={setGraphMetricKey}
                onUploadVideo={openMetricUploadModal}
                onEnterValue={openMetricValueModal}
                onWatchVideo={openWatchVideoModal}
                onViewCoachVerification={setCoachVerificationMetricKey}
                showUploadControls
              />
            ))}
          </div>
        </div>
      )}

      {/* Pitching metrics */}
      {pitchingKeys.length > 0 && (
        <div style={groupStyle}>
          <p style={groupHeaderStyle}>Pitching</p>
          <div style={gridStyle}>
            {pitchingKeys.map(key => (
              <MetricCard
                key={key}
                metricKey={key}
                personalBest={getPersonalBest(key)}
                allEntries={getAllEntries(key)}
                onShowGraph={setGraphMetricKey}
                onUploadVideo={openMetricUploadModal}
                onEnterValue={openMetricValueModal}
                onWatchVideo={openWatchVideoModal}
                onViewCoachVerification={setCoachVerificationMetricKey}
                showUploadControls
              />
            ))}
          </div>
        </div>
      )}

      {/* Throwing metrics */}
      {throwingKeys.length > 0 && (
        <div style={groupStyle}>
          <p style={groupHeaderStyle}>Throwing</p>
          <div style={gridStyle}>
            {throwingKeys.map(key => (
              <MetricCard
                key={key}
                metricKey={key}
                personalBest={getPersonalBest(key)}
                allEntries={getAllEntries(key)}
                onShowGraph={setGraphMetricKey}
                onUploadVideo={openMetricUploadModal}
                onEnterValue={openMetricValueModal}
                onWatchVideo={openWatchVideoModal}
                onViewCoachVerification={setCoachVerificationMetricKey}
                showUploadControls
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload new metric */}
      <div style={{ marginBottom: '2rem' }}>
        <a
          href="/dashboard/athlete/metrics/upload"
          style={{
            display: 'inline-block',
            backgroundColor: '#e8a020',
            color: '#000000',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '0.65rem 1.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Upload New Metric
        </a>
      </div>

      {/* Highlight videos */}
      {highlightSlotLimit > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1e2530' }}>
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Highlight Videos
            </p>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              {usedSlots} / {highlightSlotLimit} slots used
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: highlightSlotLimit }, (_, i) => i + 1).map(slot => {
              const video = highlights.find(h => h.slot_number === slot) ?? null;
              return (
                <HighlightSlot
                  key={slot}
                  slot={slot}
                  video={video}
                  onUpload={setHighlightUploadSlot}
                  onDelete={handleHighlightDeleted}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* MetricsGraph modal */}
      {graphMetricKey !== null && (
        <div style={overlayStyle} onClick={() => setGraphMetricKey(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '680px' }}>
            <MetricsGraph
              metricKey={graphMetricKey}
              entries={getAllEntries(graphMetricKey)}
              onClose={() => setGraphMetricKey(null)}
            />
          </div>
        </div>
      )}

      {/* Video upload modal for metric */}
      {videoUploadMetricKey !== null && (
        <div style={overlayStyle} onClick={closeMetricUploadModal}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px' }}>

            {metricUploadPhase === 'upload' && (
              <>
                {videoUploadError && (
                  <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                    {videoUploadError}
                  </p>
                )}
                <VideoUpload
                  athleteClerkId={athleteClerkId}
                  uploadType="metric"
                  metricKey={videoUploadMetricKey}
                  onUploadComplete={(url: string) => { setVideoUploadError(null); handleVideoUploaded(videoUploadMetricKey, url); }}
                  onError={(msg: string) => setVideoUploadError(msg)}
                />
              </>
            )}

            {metricUploadPhase === 'value' && (
              <div style={{
                background: '#111827',
                border: '1px solid #1e2530',
                borderRadius: '0.75rem',
                padding: '2rem',
              }}>
                <h3 style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.4rem' }}>
                  Video uploaded!
                </h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                  Enter your {METRIC_INFO[videoUploadMetricKey].label} to complete your profile.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    value={metricValueInput}
                    onChange={e => setMetricValueInput(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="any"
                    autoFocus
                    style={{
                      flex: 1,
                      background: '#0d1117',
                      border: '1px solid #1e2530',
                      borderRadius: '0.5rem',
                      color: '#f0f6fc',
                      padding: '0.6rem 0.75rem',
                      fontSize: '1.1rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: '#6b7280', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {METRIC_INFO[videoUploadMetricKey].unit}
                  </span>
                </div>
                {metricValueError && (
                  <p style={{ color: '#f87171', fontSize: '0.83rem', margin: '0 0 0.75rem' }}>
                    {metricValueError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={closeMetricUploadModal}
                    style={{
                      background: 'transparent',
                      border: '1px solid #4b5563',
                      color: '#9ca3af',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleMetricValueSave}
                    disabled={metricValueSaving || !metricValueInput}
                    style={{
                      background: metricValueSaving || !metricValueInput ? '#374151' : '#e8a020',
                      color: metricValueSaving || !metricValueInput ? '#6b7280' : '#000',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      cursor: metricValueSaving || !metricValueInput ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {metricValueSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Watch video modal */}
      {watchVideoMetricKey !== null && (() => {
        const pb = getPersonalBest(watchVideoMetricKey);
        const videoUrl = pb?.video_url ?? null;
        const metricLabel = METRIC_INFO[watchVideoMetricKey].label;
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(13,17,23,0.90)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
            onClick={closeWatchVideoModal}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '720px',
                background: '#111827',
                border: '1px solid #1e2530',
                borderRadius: '0.75rem',
                overflow: 'hidden',
              }}
            >
              {/* Modal header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #1e2530',
              }}>
                <span style={{
                  color: '#f0f6fc',
                  fontWeight: 700,
                  fontSize: '1rem',
                  fontFamily: 'Georgia, serif',
                }}>
                  {metricLabel}
                </span>
                <button
                  onClick={closeWatchVideoModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                  aria-label="Close video player"
                >
                  &#x2715;
                </button>
              </div>

              {/* Video player */}
              <div style={{ backgroundColor: '#000', lineHeight: 0 }}>
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: '70vh', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#4b5563',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                  }}>
                    No video available for this metric.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Video upload modal for highlight */}
      {highlightUploadSlot !== null && (
        <div style={overlayStyle} onClick={() => { setHighlightUploadSlot(null); setVideoUploadError(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px' }}>
            {videoUploadError && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                {videoUploadError}
              </p>
            )}
            <VideoUpload
              athleteClerkId={athleteClerkId}
              uploadType="highlight"
              slotNumber={highlightUploadSlot}
              onUploadComplete={(url: string) => { setVideoUploadError(null); handleHighlightUploaded(url, highlightUploadSlot); }}
              onError={(msg: string) => setVideoUploadError(msg)}
            />
          </div>
        </div>
      )}

      {/* Third-party import modal */}
      {showImportModal && (
        <ThirdPartyImportModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Coach verification details modal */}
      {coachVerificationMetricKey !== null && (
        <CoachVerificationModal
          metricKey={coachVerificationMetricKey}
          onClose={() => setCoachVerificationMetricKey(null)}
        />
      )}
    </>
  );
}
