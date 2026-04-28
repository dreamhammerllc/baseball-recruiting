'use client';

import { useState, useRef } from 'react';
import { METRIC_KEYS, METRIC_INFO } from '@/lib/metrics';
import type { AthleteMetric, MetricKey, VerificationType } from '@/lib/metrics';

// ─── Constants ────────────────────────────────────────────────────────────────

type ToolType = 'hittrax' | 'rapsodo' | 'blast_motion';

const TOOLS: { id: ToolType; label: string; description: string }[] = [
  {
    id:          'hittrax',
    label:       'HitTrax',
    description: 'Exit Velocity \u00B7 Launch Angle \u00B7 Distance',
  },
  {
    id:          'rapsodo',
    label:       'Rapsodo',
    description: 'Fastball \u00B7 Curveball \u00B7 Slider Velocity',
  },
  {
    id:          'blast_motion',
    label:       'Blast Motion',
    description: 'Bat Speed \u00B7 Attack Angle',
  },
];

const TOOL_VERIFICATION: Record<ToolType, VerificationType> = {
  hittrax:      'third_party_hittrax',
  rapsodo:      'third_party_rapsodo',
  blast_motion: 'third_party_blast_motion',
};

const TOOL_SOURCE_LABEL: Record<ToolType, string> = {
  hittrax:      'HitTrax Import',
  rapsodo:      'Rapsodo Import',
  blast_motion: 'Blast Motion Import',
};

const METRIC_KEY_SET = new Set<string>(METRIC_KEYS);

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onImportComplete: (savedMetrics: AthleteMetric[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThirdPartyImportModal({ onClose, onImportComplete }: Props) {
  const [step, setStep]                       = useState<1 | 2 | 3>(1);
  const [selectedTool, setSelectedTool]       = useState<ToolType | null>(null);
  const [file, setFile]                       = useState<File | null>(null);
  const [isDragOver, setIsDragOver]           = useState(false);
  const [analyzing, setAnalyzing]             = useState(false);
  const [analyzeError, setAnalyzeError]       = useState<string | null>(null);
  const [extractedMetrics, setExtractedMetrics] = useState<Record<string, number>>({});
  const [editedValues, setEditedValues]       = useState<Record<string, string>>({});
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const fileInputRef                          = useRef<HTMLInputElement>(null);

  const saveableKeys = Object.keys(extractedMetrics).filter(
    k => METRIC_KEY_SET.has(k),
  ) as MetricKey[];

  // ── File handling ─────────────────────────────────────────────────────────

  function handleFileSelect(f: File) {
    const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!validTypes.includes(f.type)) {
      setAnalyzeError('Please upload a PNG, JPEG, or PDF file.');
      return;
    }
    setFile(f);
    setAnalyzeError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  // ── Analyze ───────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!file || !selectedTool) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/metrics/import-third-party', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tool: selectedTool, fileData: base64, fileType: file.type }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Analysis failed.');

      const rawMetrics: Record<string, number> = json.metrics ?? {};
      setExtractedMetrics(rawMetrics);

      const initial: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawMetrics)) {
        if (METRIC_KEY_SET.has(k)) initial[k] = String(v);
      }
      setEditedValues(initial);
      setStep(3);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Analysis failed. Please try again.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSaveAll() {
    if (!selectedTool || saveableKeys.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const verificationType = TOOL_VERIFICATION[selectedTool];
    const sourceLabel      = TOOL_SOURCE_LABEL[selectedTool];
    const savedMetrics: AthleteMetric[] = [];

    try {
      for (const key of saveableKeys) {
        const numVal = parseFloat(editedValues[key] ?? '');
        if (isNaN(numVal) || numVal <= 0) continue;

        const res = await fetch('/api/metrics', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            metric_key:        key,
            value:             numVal,
            verification_type: verificationType,
            source_label:      sourceLabel,
            ai_confidence:     95,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? `Failed to save ${key}.`);
        if (json.metric) savedMetrics.push(json.metric as AthleteMetric);
      }
      onImportComplete(savedMetrics);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Save failed. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const headerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '1.125rem 1.5rem',
    borderBottom:   '1px solid #1e2530',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '1.5rem',
  };

  const footerStyle: React.CSSProperties = {
    padding:        '1rem 1.5rem',
    borderTop:      '1px solid #1e2530',
    display:        'flex',
    justifyContent: 'flex-end',
    gap:            '0.75rem',
  };

  const cancelBtnStyle: React.CSSProperties = {
    background:   'transparent',
    border:       '1px solid #374151',
    color:        '#9ca3af',
    borderRadius: '0.5rem',
    padding:      '0.5rem 1rem',
    fontSize:     '0.875rem',
    cursor:       'pointer',
  };

  function primaryBtnStyle(disabled: boolean): React.CSSProperties {
    return {
      background:   disabled ? '#374151' : '#e8a020',
      color:        disabled ? '#6b7280' : '#000',
      border:       'none',
      borderRadius: '0.5rem',
      padding:      '0.5rem 1.25rem',
      fontSize:     '0.875rem',
      fontWeight:   700,
      cursor:       disabled ? 'not-allowed' : 'pointer',
    };
  }

  // ── Step 1 — Tool selection ───────────────────────────────────────────────

  function renderStep1() {
    return (
      <>
        <div style={bodyStyle}>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
            Select the tool you are importing data from.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {TOOLS.map(tool => {
              const isSelected = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  style={{
                    background:    isSelected ? 'rgba(232,160,32,0.06)' : '#111827',
                    border:        `1px solid ${isSelected ? '#e8a020' : '#1e2530'}`,
                    borderRadius:  '0.5rem',
                    padding:       '1rem 1.25rem',
                    cursor:        'pointer',
                    textAlign:     'left',
                    width:         '100%',
                    transition:    'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div
                    style={{
                      color:        isSelected ? '#e8a020' : '#f0f6fc',
                      fontWeight:   700,
                      fontSize:     '0.95rem',
                      marginBottom: '0.3rem',
                    }}
                  >
                    {tool.label}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {tool.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={footerStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={() => setStep(2)}
            disabled={!selectedTool}
            style={primaryBtnStyle(!selectedTool)}
          >
            Next
          </button>
        </div>
      </>
    );
  }

  // ── Step 2 — Upload ───────────────────────────────────────────────────────

  function renderStep2() {
    const toolLabel = TOOLS.find(t => t.id === selectedTool)?.label ?? '';
    return (
      <>
        <div style={bodyStyle}>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
            Upload a screenshot or PDF from {toolLabel}.
          </p>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border:          `2px dashed ${isDragOver ? '#58a6ff' : file ? '#e8a020' : '#374151'}`,
              borderRadius:    '0.5rem',
              padding:         '2.25rem 1.5rem',
              textAlign:       'center',
              cursor:          'pointer',
              backgroundColor: isDragOver ? 'rgba(88,166,255,0.04)' : 'transparent',
              transition:      'border-color 0.15s, background 0.15s',
              marginBottom:    '0.75rem',
            }}
          >
            {file ? (
              <div>
                <div style={{ color: '#34d399', fontSize: '1.75rem', marginBottom: '0.4rem', lineHeight: 1 }}>
                  &#10003;
                </div>
                <div style={{ color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 600, wordBreak: 'break-all' }}>
                  {file.name}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  Click to change file
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: '#4b5563', fontSize: '2.25rem', marginBottom: '0.5rem', lineHeight: 1 }}>
                  &#8679;
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  Drag and drop or click to browse
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.78rem' }}>
                  PNG, JPEG, or PDF
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = '';
            }}
          />

          {analyzeError && (
            <p style={{ color: '#f87171', fontSize: '0.83rem', margin: '0.5rem 0 0' }}>
              {analyzeError}
            </p>
          )}

          {analyzing && (
            <>
              <style>{`@keyframes dvSpin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <div
                  style={{
                    width:           '18px',
                    height:          '18px',
                    border:          '2px solid #1e2530',
                    borderTopColor:  '#e8a020',
                    borderRadius:    '50%',
                    animation:       'dvSpin 0.7s linear infinite',
                    flexShrink:      0,
                  }}
                />
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Analyzing your report...</span>
              </div>
            </>
          )}
        </div>

        <div style={footerStyle}>
          <button
            onClick={() => { setStep(1); setFile(null); setAnalyzeError(null); }}
            style={cancelBtnStyle}
          >
            Back
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            style={primaryBtnStyle(!file || analyzing)}
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </>
    );
  }

  // ── Step 3 — Review ───────────────────────────────────────────────────────

  function renderStep3() {
    const toolLabel = TOOLS.find(t => t.id === selectedTool)?.label ?? '';
    const noResults = saveableKeys.length === 0;

    return (
      <>
        <div style={bodyStyle}>
          {noResults ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ color: '#f87171', fontSize: '2rem', marginBottom: '0.75rem', lineHeight: 1 }}>
                &#9888;
              </div>
              <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
                No supported metrics found
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.83rem', margin: 0 }}>
                Make sure the {toolLabel} report is clearly visible in the image and try again.
              </p>
            </div>
          ) : (
            <>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                Review the extracted values. Edit any that need correction before saving.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {saveableKeys.map(key => {
                  const info = METRIC_INFO[key];
                  return (
                    <div
                      key={key}
                      style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'space-between',
                        gap:            '1rem',
                        background:     '#111827',
                        border:         '1px solid #1e2530',
                        borderRadius:   '0.5rem',
                        padding:        '0.75rem 1rem',
                      }}
                    >
                      <div>
                        <div style={{ color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 600 }}>
                          {info.label}
                        </div>
                        <div
                          style={{
                            color:      '#58a6ff',
                            fontSize:   '0.72rem',
                            fontWeight: 600,
                            marginTop:  '0.15rem',
                          }}
                        >
                          {toolLabel} verified
                        </div>
                      </div>
                      <div
                        style={{
                          display:    'flex',
                          alignItems: 'center',
                          gap:        '0.5rem',
                          flexShrink: 0,
                        }}
                      >
                        <input
                          type="number"
                          value={editedValues[key] ?? ''}
                          onChange={e =>
                            setEditedValues(prev => ({ ...prev, [key]: e.target.value }))
                          }
                          min="0"
                          step="any"
                          style={{
                            width:      '80px',
                            background: '#0d1117',
                            border:     '1px solid #1e2530',
                            borderRadius: '0.375rem',
                            color:      '#f0f6fc',
                            padding:    '0.4rem 0.6rem',
                            fontSize:   '0.9rem',
                            fontFamily: 'monospace',
                            textAlign:  'right',
                            outline:    'none',
                          }}
                        />
                        <span style={{ color: '#6b7280', fontSize: '0.8rem', minWidth: '2.5rem' }}>
                          {info.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {saveError && (
            <p style={{ color: '#f87171', fontSize: '0.83rem', marginTop: '0.75rem', marginBottom: 0 }}>
              {saveError}
            </p>
          )}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          {!noResults && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={primaryBtnStyle(saving)}
            >
              {saving ? 'Saving...' : `Save All (${saveableKeys.length})`}
            </button>
          )}
          {noResults && (
            <button
              onClick={() => { setStep(2); setAnalyzeError(null); }}
              style={primaryBtnStyle(false)}
            >
              Try Again
            </button>
          )}
        </div>
      </>
    );
  }

  // ── Step progress labels ──────────────────────────────────────────────────

  const stepTitles: Record<1 | 2 | 3, string> = {
    1: 'Import Data',
    2: 'Upload Report',
    3: 'Review Metrics',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(13,17,23,0.90)',
        zIndex:          200,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:           '100%',
          maxWidth:        '560px',
          backgroundColor: '#0d1117',
          border:          '1px solid #1e2530',
          borderRadius:    '0.75rem',
          overflow:        'hidden',
        }}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2
            style={{
              color:       '#f0f6fc',
              fontWeight:  700,
              fontSize:    '1rem',
              fontFamily:  'Georgia, serif',
              margin:      0,
            }}
          >
            {stepTitles[step]}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background:   'transparent',
              border:       'none',
              color:        '#6b7280',
              fontSize:     '1.25rem',
              lineHeight:   1,
              cursor:       'pointer',
              padding:      '0.25rem 0.5rem',
              borderRadius: '0.375rem',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f6fc'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            &#x2715;
          </button>
        </div>

        {/* Step progress bar */}
        <div
          style={{
            display:      'flex',
            padding:      '0.75rem 1.5rem',
            gap:          '0.5rem',
            borderBottom: '1px solid #1e2530',
          }}
        >
          {([1, 2, 3] as const).map(n => (
            <div
              key={n}
              style={{
                height:          '3px',
                flex:            1,
                borderRadius:    '9999px',
                backgroundColor: step >= n ? '#e8a020' : '#1e2530',
                transition:      'background-color 0.2s',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
