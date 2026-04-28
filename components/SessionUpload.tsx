'use client';

import { useState, useRef } from 'react';
import type { MetricKey } from '@/lib/metrics';
import { METRIC_INFO } from '@/lib/metrics';

type SourceType = 'hittrax' | 'rapsodo' | 'blast_motion' | 'perfect_game';
type Step = 'select' | 'analyzing' | 'confirm' | 'error';

interface ExtractedData {
  metrics: Record<string, number>;
  sessionDate: string | null;
  confidence: number;
  flags?: string[];
}

interface SessionUploadProps {
  athleteClerkId: string;
  athleteName: string;
  onConfirm: (
    metrics: Record<string, number>,
    sessionDate: string | null,
    sourceType: string,
    confidence: number
  ) => void;
  onCancel: () => void;
}

const SOURCE_CARDS: Array<{
  id: SourceType;
  name: string;
  description: string;
}> = [
  {
    id: 'hittrax',
    name: 'HitTrax',
    description: 'Exit velocity, launch angle, distance, and batted-ball data',
  },
  {
    id: 'rapsodo',
    name: 'Rapsodo',
    description: 'Pitching and hitting metrics including spin rate and trajectory',
  },
  {
    id: 'blast_motion',
    name: 'Blast Motion',
    description: 'Swing metrics including bat speed, attack angle, and time to impact',
  },
  {
    id: 'perfect_game',
    name: 'Perfect Game',
    description: 'Event-based scouting reports and measurable data',
  },
];

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#f59e0b' : '#f87171';
  const rgb = score >= 80 ? '52,211,153' : score >= 60 ? '245,158,11' : '248,113,113';
  const label = score >= 80 ? 'High Confidence' : score >= 60 ? 'Medium Confidence' : 'Low Confidence';
  return (
    <span
      style={{
        background: `rgba(${rgb}, 0.12)`,
        border: `1px solid rgba(${rgb}, 0.3)`,
        color,
        borderRadius: '9999px',
        padding: '0.2rem 0.7rem',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}
    >
      {score}% &mdash; {label}
    </span>
  );
}

export default function SessionUpload({
  athleteClerkId: _athleteClerkId,
  athleteName,
  onConfirm,
  onCancel,
}: SessionUploadProps) {
  const [step, setStep] = useState<Step>('select');
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleAnalyze() {
    if (!selectedFile || !sourceType) return;
    setStep('analyzing');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceType', sourceType);
      formData.append('athleteName', athleteName);
      const res = await fetch('/api/analyze-session', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Analysis failed');
      setExtracted(json.extracted);
      setStep('confirm');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed');
      setStep('error');
    }
  }

  // ── Step: analyzing ─────────────────────────────────────────────────────────
  if (step === 'analyzing') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#e8a020',
              animation: 'sessionPulse 1.2s ease-in-out infinite',
            }}
          />
          <span style={{ color: '#f0f6fc', fontSize: '1rem', fontWeight: 600 }}>
            Analyzing document with AI...
          </span>
        </div>
        <style>{`
          @keyframes sessionPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.8); }
          }
        `}</style>
      </div>
    );
  }

  // ── Step: error ──────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            color: '#f87171',
            fontSize: '0.9rem',
          }}
        >
          {errorMsg || 'An unexpected error occurred.'}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setStep('select');
              setErrorMsg('');
              setSelectedFile(null);
            }}
            style={{
              background: '#e8a020',
              border: 'none',
              color: '#0d1117',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #4b5563',
              color: '#9ca3af',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Step: confirm ────────────────────────────────────────────────────────────
  if (step === 'confirm' && extracted) {
    const { metrics, sessionDate, confidence, flags } = extracted;
    const metricKeys = Object.keys(metrics) as MetricKey[];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem' }}>
            Extracted Data
          </span>
          <ConfidenceBadge score={confidence} />
        </div>

        {sessionDate && (
          <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>
            Session date: <span style={{ color: '#9ca3af' }}>{sessionDate}</span>
          </div>
        )}

        {/* Low confidence warning */}
        {confidence < 80 && (
          <div
            style={{
              borderLeft: '3px solid #e8a020',
              paddingLeft: '0.875rem',
              background: 'rgba(232,160,32,0.06)',
              borderRadius: '0 0.4rem 0.4rem 0',
              padding: '0.75rem 0.875rem',
              color: '#d4911c',
              fontSize: '0.82rem',
            }}
          >
            Confidence too low for automatic verification. This will be flagged for manual review.
          </div>
        )}

        {/* Flags */}
        {flags && flags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {flags.map((flag, i) => (
              <div
                key={i}
                style={{
                  borderLeft: '3px solid #e8a020',
                  background: 'rgba(232,160,32,0.06)',
                  borderRadius: '0 0.4rem 0.4rem 0',
                  padding: '0.6rem 0.875rem',
                  color: '#f0f6fc',
                  fontSize: '0.82rem',
                }}
              >
                {flag}
              </div>
            ))}
          </div>
        )}

        {/* Metrics table */}
        <div
          style={{
            border: '1px solid #1e2530',
            borderRadius: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              background: '#0d1117',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid #1e2530',
            }}
          >
            <span style={{ color: '#4b5563', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</span>
            <span style={{ color: '#4b5563', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', marginRight: '0.75rem' }}>Value</span>
            <span style={{ color: '#4b5563', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Unit</span>
          </div>

          {metricKeys.map((key, i) => {
            const info = METRIC_INFO[key];
            const value = metrics[key];
            return (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  padding: '0.6rem 1rem',
                  borderBottom: i < metricKeys.length - 1 ? '1px solid #1e2530' : 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#f0f6fc', fontSize: '0.875rem' }}>
                  {info ? info.label : key}
                </span>
                <span style={{ color: '#e8a020', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', marginRight: '0.75rem' }}>
                  {value}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.78rem', textAlign: 'right' }}>
                  {info ? info.unit : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid #4b5563',
              color: '#9ca3af',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
              (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563';
              (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(metrics, sessionDate, sourceType ?? '', confidence)}
            style={{
              background: '#e8a020',
              border: 'none',
              color: '#0d1117',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.5rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#d4911c';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#e8a020';
            }}
          >
            Confirm and Submit
          </button>
        </div>
      </div>
    );
  }

  // ── Step: select ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Source type selector */}
      <div>
        <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Select Data Source
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {SOURCE_CARDS.map(card => {
            const isSelected = sourceType === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSourceType(card.id)}
                style={{
                  background: isSelected ? 'rgba(232,160,32,0.08)' : '#0d1117',
                  border: `1px solid ${isSelected ? '#e8a020' : '#1e2530'}`,
                  borderRadius: '0.6rem',
                  padding: '0.875rem 1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.4)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e2530';
                  }
                }}
              >
                <span style={{ color: isSelected ? '#e8a020' : '#f0f6fc', fontWeight: 700, fontSize: '0.88rem' }}>
                  {card.name}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.73rem', lineHeight: 1.4 }}>
                  {card.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* File upload */}
      <div>
        <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Upload File
        </p>
        <div
          style={{
            border: '2px dashed #1e2530',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#e8a020';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2530';
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.jpg,.jpeg,.png,.webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!selectedFile ? (
            <>
              <div style={{ marginBottom: '0.5rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p style={{ color: '#6b7280', margin: '0 0 0.25rem', fontSize: '0.88rem' }}>
                Click to upload a PDF, CSV, or image
              </p>
              <p style={{ color: '#4b5563', margin: 0, fontSize: '0.75rem' }}>
                .pdf, .csv, .jpg, .png, .webp accepted
              </p>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.875rem' }}>
                {selectedFile.name}
              </span>
              <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>Click to change</span>
            </div>
          )}
        </div>
      </div>

      {/* Analyze button + cancel */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: '1px solid #4b5563',
            color: '#9ca3af',
            borderRadius: '0.5rem',
            padding: '0.5rem 1.25rem',
            fontSize: '0.88rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleAnalyze}
          disabled={!selectedFile || !sourceType}
          style={{
            background: selectedFile && sourceType ? '#e8a020' : '#1e2530',
            border: 'none',
            color: selectedFile && sourceType ? '#0d1117' : '#4b5563',
            borderRadius: '0.5rem',
            padding: '0.5rem 1.5rem',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: selectedFile && sourceType ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            if (selectedFile && sourceType) {
              (e.currentTarget as HTMLButtonElement).style.background = '#d4911c';
            }
          }}
          onMouseLeave={e => {
            if (selectedFile && sourceType) {
              (e.currentTarget as HTMLButtonElement).style.background = '#e8a020';
            }
          }}
        >
          Analyze Document
        </button>
      </div>
    </div>
  );
}
