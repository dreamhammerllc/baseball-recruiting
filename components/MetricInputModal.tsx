'use client';

import { useState } from 'react';
import { METRIC_KEYS, METRIC_INFO, type MetricKey, type AthleteMetric } from '@/lib/metrics';

interface Props {
  onClose: () => void;
  onSaved: (metric: AthleteMetric, demotedId: string | null) => void;
  defaultMetricKey?: MetricKey;
}

export default function MetricInputModal({ onClose, onSaved, defaultMetricKey }: Props) {
  const [metricKey, setMetricKey] = useState<MetricKey>(defaultMetricKey ?? METRIC_KEYS[0]);
  const [value, setValue] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = METRIC_INFO[metricKey];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      setError('Please enter a valid positive number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/athlete/self-report-metric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_key: metricKey,
          value: numVal,
          video_url: videoUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to save metric.');
      onSaved(json.metric as AthleteMetric, json.demotedId ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSaving(false);
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
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: '#9ca3af',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'block',
    marginBottom: '0.4rem',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1e2530',
          borderRadius: '0.75rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '460px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
              Add Metric
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
              Self-reported stats are visible to coaches and clearly labeled.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#4b5563',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: '0.1rem',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Metric picker */}
          <div>
            <label style={labelStyle}>Metric</label>
            <select
              value={metricKey}
              onChange={e => {
                setMetricKey(e.target.value as MetricKey);
                setValue('');
                setError(null);
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

          {/* Value + unit */}
          <div>
            <label style={labelStyle}>
              Value ({info.unit}){info.lowerIsBetter ? ' — lower is better' : ''}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                step="any"
                min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={`e.g. ${info.unit === 's' ? '6.8' : info.unit === 'mph' ? '88' : '90'}`}
                required
                autoFocus
                style={{ ...inputStyle, flex: 1 }}
              />
              <span style={{ color: '#6b7280', fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {info.unit}
              </span>
            </div>
          </div>

          {/* Optional video URL */}
          <div>
            <label style={labelStyle}>Video Link (optional)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
            <p style={{ color: '#4b5563', fontSize: '0.73rem', margin: '0.35rem 0 0' }}>
              Paste a link to supporting video footage (YouTube, Hudl, etc.)
            </p>
          </div>

          {/* Disclaimer */}
          <div style={{
            backgroundColor: 'rgba(107,114,128,0.08)',
            border: '1px solid rgba(107,114,128,0.2)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
          }}>
            <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: 0, lineHeight: 1.55 }}>
              <strong style={{ color: '#d1d5db' }}>Self-Reported</strong> — this stat will be visible to coaches
              with a &quot;Self Reported&quot; label. To earn a Coach Verified badge, book a session with a
              Diamond Verified coach.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #374151',
                color: '#6b7280',
                borderRadius: '0.5rem',
                padding: '0.6rem 1.25rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !value}
              style={{
                backgroundColor: saving || !value ? '#374151' : '#e8a020',
                color: saving || !value ? '#6b7280' : '#000000',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.6rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: saving || !value ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {saving ? 'Saving...' : 'Save Metric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
