'use client';

import { useState } from 'react';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import SessionUpload from '@/components/SessionUpload';
import { METRIC_INFO, METRIC_KEYS, VERIFICATION_TYPES } from '@/lib/metrics';
import type { MetricKey, VerificationType } from '@/lib/metrics';

type TabId = 'session' | 'manual';

type SourceType = 'hittrax' | 'rapsodo' | 'blast_motion' | 'perfect_game';

const SOURCE_TO_VERIFICATION: Record<SourceType, VerificationType> = {
  hittrax:       'third_party_hittrax',
  rapsodo:       'third_party_rapsodo',
  blast_motion:  'third_party_blast_motion',
  perfect_game:  'third_party_perfect_game',
};

const MANUAL_VERIFICATION_TYPES: VerificationType[] = [
  'self_reported',
  'third_party_hittrax',
  'third_party_rapsodo',
  'third_party_blast_motion',
  'third_party_perfect_game',
];

const VERIFICATION_LABELS: Record<VerificationType, string> = {
  coach_verified:             'Coach Verified',
  third_party_hittrax:        '3rd Party - HitTrax',
  third_party_rapsodo:        '3rd Party - Rapsodo',
  third_party_blast_motion:   '3rd Party - Blast Motion',
  third_party_perfect_game:   '3rd Party - Perfect Game',
  self_reported:              'Self Reported',
};

// ─── Manual Entry Form ────────────────────────────────────────────────────────

function ManualEntryForm() {
  const today = new Date().toISOString().split('T')[0];

  const [metricKey, setMetricKey] = useState<MetricKey>(METRIC_KEYS[0]);
  const [value, setValue] = useState('');
  const [verificationType, setVerificationType] = useState<VerificationType>('self_reported');
  const [sourceLabel, setSourceLabel] = useState('');
  const [recordedAt, setRecordedAt] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setError('Please enter a valid positive number.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_key: metricKey,
          value: numVal,
          verification_type: verificationType,
          source_label: sourceLabel.trim() || null,
          recorded_at: recordedAt ? new Date(recordedAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save metric.');
      }
      setSuccess(true);
      setValue('');
      setSourceLabel('');
      setRecordedAt(today);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: '0.5rem',
    color: '#f0f6fc',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'block',
    marginBottom: '0.4rem',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '480px' }}>
      {/* Metric selector */}
      <div>
        <label style={labelStyle}>Metric</label>
        <select
          value={metricKey}
          onChange={e => setMetricKey(e.target.value as MetricKey)}
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

      {/* Verification type */}
      <div>
        <label style={labelStyle}>Verification Type</label>
        <select
          value={verificationType}
          onChange={e => setVerificationType(e.target.value as VerificationType)}
          style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
        >
          {MANUAL_VERIFICATION_TYPES.map(v => (
            <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Source label */}
      <div>
        <label style={labelStyle}>Source Label (optional)</label>
        <input
          type="text"
          value={sourceLabel}
          onChange={e => setSourceLabel(e.target.value)}
          placeholder="e.g. Spring tryout, Showcase event..."
          style={inputStyle}
        />
      </div>

      {/* Date */}
      <div>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={recordedAt}
          onChange={e => setRecordedAt(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Status messages */}
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{error}</p>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ color: '#4ade80', fontSize: '0.875rem', margin: 0 }}>Metric saved successfully.</p>
          <a
            href="/dashboard/athlete/metrics"
            style={{ color: '#58a6ff', fontSize: '0.875rem', textDecoration: 'underline' }}
          >
            View My Metrics
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          backgroundColor: submitting ? '#374151' : '#e8a020',
          color: submitting ? '#6b7280' : '#000000',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.65rem 1.5rem',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.15s',
          width: 'fit-content',
        }}
      >
        {submitting ? 'Saving...' : 'Save Metric'}
      </button>
    </form>
  );
}

// ─── Session Report Tab ───────────────────────────────────────────────────────

function SessionReportTab() {
  const [sessionResult, setSessionResult] = useState<{
    metrics: Record<string, number>;
    confidence: number;
    sessionDate: string | null;
    sourceType: SourceType;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleConfirm(
    extractedMetrics: Record<string, number>,
    sessionDate: string | null,
    sourceType: SourceType,
    confidence: number,
  ) {
    setSessionResult({ metrics: extractedMetrics, confidence, sessionDate, sourceType });
  }

  async function handleSaveAll() {
    if (!sessionResult) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const verificationType = SOURCE_TO_VERIFICATION[sessionResult.sourceType];
    const validKeys = new Set(METRIC_KEYS as readonly string[]);
    const entries = Object.entries(sessionResult.metrics).filter(([k]) => validKeys.has(k));

    let failed = 0;
    for (const [metric_key, value] of entries) {
      try {
        const res = await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric_key,
            value,
            verification_type: verificationType,
            ai_confidence: sessionResult.confidence,
            recorded_at: sessionResult.sessionDate
              ? new Date(sessionResult.sessionDate).toISOString()
              : null,
          }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setSaving(false);
    if (failed > 0) {
      setSaveError(`${failed} metric(s) could not be saved. Please try again.`);
    } else {
      setSaveSuccess(true);
    }
  }

  if (saveSuccess) {
    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '560px',
      }}>
        <p style={{ color: '#4ade80', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Session saved successfully!
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Your metrics have been updated.
        </p>
        <a
          href="/dashboard/athlete/metrics"
          style={{
            display: 'inline-block',
            backgroundColor: '#e8a020',
            color: '#000000',
            fontWeight: 700,
            fontSize: '0.875rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            width: 'fit-content',
          }}
        >
          View My Metrics
        </a>
      </div>
    );
  }

  if (sessionResult) {
    const validKeys = new Set(METRIC_KEYS as readonly string[]);
    const entries = Object.entries(sessionResult.metrics).filter(([k]) => validKeys.has(k));

    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '0.75rem',
        padding: '2rem',
        maxWidth: '560px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        <div>
          <h3 style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
            Confirm Extracted Metrics
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
            AI confidence: {sessionResult.confidence}%
            {sessionResult.sessionDate ? ` — Session date: ${sessionResult.sessionDate}` : ''}
          </p>
        </div>

        {entries.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
            No recognizable metrics were extracted from the document.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {entries.map(([key, val]) => {
              const info = METRIC_INFO[key as MetricKey];
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #1e2530' }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{info?.label ?? key}</span>
                  <span style={{ color: '#f0f6fc', fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700 }}>
                    {val} {info?.unit ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {saveError && (
          <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{saveError}</p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {entries.length > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                backgroundColor: saving ? '#374151' : '#e8a020',
                color: saving ? '#6b7280' : '#000000',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.65rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save All Metrics'}
            </button>
          )}
          <button
            onClick={() => setSessionResult(null)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #1e2530',
              color: '#6b7280',
              borderRadius: '0.5rem',
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Re-upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionUpload
      onConfirm={(metrics, sessionDate, sourceType, confidence) =>
        handleConfirm(metrics, sessionDate, sourceType as SourceType, confidence)
      }
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<TabId>('session');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.55rem 1.25rem',
    borderRadius: '0.4rem',
    border: 'none',
    backgroundColor: active ? '#1e2530' : 'transparent',
    color: active ? '#f0f6fc' : '#6b7280',
    fontWeight: active ? 600 : 400,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        {/* Back link */}
        <a
          href="/dashboard/athlete/metrics"
          style={{ color: '#58a6ff', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '1.5rem' }}
        >
          ← Back to Metrics
        </a>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Submit New Session
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Upload a session report or enter metrics manually
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'inline-flex',
          backgroundColor: '#111827',
          border: '1px solid #1e2530',
          borderRadius: '0.5rem',
          padding: '0.25rem',
          gap: '0.25rem',
          marginBottom: '2rem',
        }}>
          <button style={tabStyle(activeTab === 'session')} onClick={() => setActiveTab('session')}>
            Session Report
          </button>
          <button style={tabStyle(activeTab === 'manual')} onClick={() => setActiveTab('manual')}>
            Manual Entry
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'session' ? <SessionReportTab /> : <ManualEntryForm />}
      </main>
    </div>
  );
}
