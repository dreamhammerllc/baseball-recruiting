'use client';

import { useState, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType      = 'transcript' | 'test_scores';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

interface ExtractedTranscript { gpa: number | null; name: string | null; }
interface ExtractedTestScores { sat: number | null; act: number | null; }
type ExtractedData = ExtractedTranscript | ExtractedTestScores;

interface DocState {
  file:           File | null;
  status:         UploadStatus;
  errorMsg:       string;
  uploadedUrl:    string | null;      // URL returned by /api/upload-document
  analysisStatus: AnalysisStatus;
  extracted:      ExtractedData | null;
}

type DocsMap = Record<DocType, DocState>;

const INITIAL_DOC: DocState = {
  file:           null,
  status:         'idle',
  errorMsg:       '',
  uploadedUrl:    null,
  analysisStatus: 'idle',
  extracted:      null,
};

// ─── Extracted-data helpers ───────────────────────────────────────────────────

function formatExtracted(type: DocType, extracted: ExtractedData): string[] {
  const lines: string[] = [];
  if (type === 'transcript') {
    const t = extracted as ExtractedTranscript;
    if (t.gpa  != null) lines.push(`GPA extracted: ${t.gpa}`);
    if (t.name != null) lines.push(`Name: ${t.name}`);
  } else {
    const s = extracted as ExtractedTestScores;
    if (s.sat != null) lines.push(`SAT extracted: ${s.sat}`);
    if (s.act != null) lines.push(`ACT extracted: ${s.act}`);
  }
  return lines;
}

function hasExtractedValue(type: DocType, extracted: ExtractedData | null): boolean {
  if (!extracted) return false;
  if (type === 'transcript') {
    const t = extracted as ExtractedTranscript;
    return t.gpa != null || t.name != null;
  }
  const s = extracted as ExtractedTestScores;
  return s.sat != null || s.act != null;
}

// ─── Upload Area ──────────────────────────────────────────────────────────────

function UploadArea({
  type,
  label,
  description,
  docState,
  onFileSelect,
  onUpload,
}: {
  type:         DocType;
  label:        string;
  description:  string;
  docState:     DocState;
  onFileSelect: (file: File) => void;
  onUpload:     () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { file, status, errorMsg, analysisStatus, extracted } = docState;
  const isSuccess   = status === 'success';
  const isUploading = status === 'uploading';
  const isAnalyzing = analysisStatus === 'analyzing';
  const analysisDone = analysisStatus === 'done' && hasExtractedValue(type, extracted);

  const borderColor = isSuccess  ? '#10b981'
    : dragging   ? '#e8a020'
    : '#1e2530';
  const zoneBg = isSuccess  ? 'rgba(16,185,129,0.05)'
    : dragging   ? 'rgba(232,160,32,0.04)'
    : '#0d1117';

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelect(dropped);
  }

  return (
    <div style={{ flex: 1, minWidth: '220px' }}>

      {/* ── Drop / select zone ──────────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && !isAnalyzing && inputRef.current?.click()}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.7rem',
          backgroundColor: zoneBg,
          transition: 'border-color 0.2s ease, background-color 0.2s ease',
          position: 'relative',
          cursor: (isUploading || isAnalyzing) ? 'default' : 'pointer',
        }}
      >
        {/* Uploaded badge */}
        {isSuccess && (
          <div style={{
            position: 'absolute', top: '0.65rem', right: '0.65rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            backgroundColor: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: '999px',
            padding: '0.2rem 0.55rem',
            fontSize: '0.65rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.04em',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Uploaded
          </div>
        )}

        {/* File icon */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '0.6rem',
          backgroundColor: isSuccess ? 'rgba(16,185,129,0.1)' : '#111827',
          border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.25)' : '#1e2530'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke={isSuccess ? '#10b981' : '#6b7280'} strokeWidth="1.75">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ffffff', fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
            {label}
          </p>
          <p style={{ color: '#4b5563', fontSize: '0.72rem', margin: 0 }}>{description}</p>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
            e.target.value = '';
          }}
        />

        {/* Choose file button */}
        <button
          type="button"
          disabled={isUploading || isAnalyzing}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          style={{
            padding: '0.45rem 1.1rem',
            backgroundColor: 'transparent',
            border: '1px solid #374151',
            borderRadius: '0.45rem',
            color: '#9ca3af',
            fontSize: '0.78rem', fontWeight: 600,
            cursor: (isUploading || isAnalyzing) ? 'default' : 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isUploading && !isAnalyzing) {
              e.currentTarget.style.borderColor = '#6b7280';
              e.currentTarget.style.color = '#d1d5db';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#374151';
            e.currentTarget.style.color = '#9ca3af';
          }}
        >
          Choose File
        </button>
      </div>

      {/* ── Below zone: filename + upload button ────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        marginTop: '0.65rem', minHeight: '30px',
      }}>
        {file && status !== 'success' && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
        <span style={{
          flex: 1, fontSize: '0.78rem',
          color: file ? '#d1d5db' : '#374151',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file ? file.name : 'No file uploaded'}
        </span>

        {file && !isSuccess && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpload(); }}
            disabled={isUploading}
            style={{
              padding: '0.3rem 0.8rem',
              backgroundColor: isUploading ? 'rgba(232,160,32,0.25)' : '#e8a020',
              border: 'none', borderRadius: '0.4rem',
              color: isUploading ? 'rgba(10,14,20,0.45)' : '#0a0e14',
              fontSize: '0.73rem', fontWeight: 700,
              cursor: isUploading ? 'default' : 'pointer',
              flexShrink: 0, transition: 'background-color 0.15s ease', whiteSpace: 'nowrap',
            }}
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        )}
      </div>

      {/* ── Upload error ─────────────────────────────────────────────────── */}
      {status === 'error' && errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.45rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: '0.73rem', color: '#ef4444' }}>{errorMsg}</span>
        </div>
      )}

      {/* ── Analysis status row ──────────────────────────────────────────── */}
      {isSuccess && (
        <div style={{ marginTop: '0.55rem' }}>

          {/* Spinner */}
          {isAnalyzing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* Pulsing dot spinner using CSS keyframes via a style tag trick */}
              <span style={{
                display: 'inline-block',
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid rgba(232,160,32,0.25)',
                borderTopColor: '#e8a020',
                animation: 'spin 0.75s linear infinite',
              }} />
              <span style={{ fontSize: '0.73rem', color: '#6b7280' }}>
                Reading document…
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Extraction results */}
          {analysisStatus === 'done' && analysisDone && extracted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {formatExtracted(type, extracted).map((line) => (
                <div key={line} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="#10b981" strokeWidth="3" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: '0.73rem', color: '#10b981', fontWeight: 600 }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Nothing found */}
          {analysisStatus === 'done' && !analysisDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="#4b5563" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: '0.73rem', color: '#4b5563' }}>
                Could not extract data — please update your profile manually.
              </span>
            </div>
          )}

          {/* Analysis error */}
          {analysisStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: '0.73rem', color: '#6b7280' }}>
                Document reading failed — your file was saved successfully.
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VerificationDocuments({ clerkUserId }: { clerkUserId: string }) {
  const [docs, setDocs] = useState<DocsMap>({
    transcript:  { ...INITIAL_DOC },
    test_scores: { ...INITIAL_DOC },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setFile(type: DocType, file: File) {
    setDocs((prev) => ({
      ...prev,
      [type]: { ...INITIAL_DOC, file },
    }));
  }

  function patchDoc(type: DocType, patch: Partial<DocState>) {
    setDocs((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload(type: DocType) {
    const { file } = docs[type];
    if (!file) return;

    patchDoc(type, { status: 'uploading', errorMsg: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', type);

      const res  = await fetch('/api/upload-document', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({})) as { error?: string; url?: string };

      if (!res.ok || data.error) {
        patchDoc(type, {
          status: 'error',
          errorMsg: data.error ?? 'Upload failed. Please try again.',
        });
        return;
      }

      // Upload succeeded — mark success and kick off analysis immediately
      const uploadedUrl = data.url ?? null;
      patchDoc(type, { status: 'success', uploadedUrl, errorMsg: '' });

      if (uploadedUrl) {
        void handleAnalyze(type, uploadedUrl);
      }

    } catch {
      patchDoc(type, {
        status: 'error',
        errorMsg: 'Network error. Please check your connection and try again.',
      });
    }
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  async function handleAnalyze(type: DocType, documentUrl: string) {
    patchDoc(type, { analysisStatus: 'analyzing' });

    try {
      const res  = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl, documentType: type, athleteId: clerkUserId }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; extracted?: ExtractedData };

      if (!res.ok || data.error) {
        console.warn('[analyze-document] response error:', data.error);
        patchDoc(type, { analysisStatus: 'error' });
        return;
      }

      patchDoc(type, {
        analysisStatus: 'done',
        extracted: data.extracted ?? null,
      });

    } catch (err) {
      console.warn('[analyze-document] fetch error:', err);
      patchDoc(type, { analysisStatus: 'error' });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const uploadedCount = Object.values(docs).filter((d) => d.status === 'success').length;

  return (
    <div style={{
      backgroundColor: '#111827',
      border: '1px solid #1e2530',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      marginTop: '2rem',
    }}>

      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Shield icon */}
          <div style={{
            width: '38px', height: '38px', borderRadius: '0.6rem',
            backgroundColor: 'rgba(232,160,32,0.1)',
            border: '1px solid rgba(232,160,32,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{
                color: '#ffffff', fontSize: '0.95rem', fontWeight: 700,
                margin: 0, letterSpacing: '-0.01em', textTransform: 'uppercase',
              }}>
                Verification Documents
              </h2>
              {uploadedCount > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, color: '#10b981',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '999px', padding: '0.15rem 0.55rem', letterSpacing: '0.04em',
                }}>
                  {uploadedCount}/2 uploaded
                </span>
              )}
            </div>
            <p style={{ color: '#4b5563', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
              Upload your transcript and test scores to unlock verified status
            </p>
          </div>
        </div>

        {/* Info badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          backgroundColor: '#0d1117', border: '1px solid #1e2530',
          borderRadius: '0.5rem', padding: '0.4rem 0.75rem', flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>PDF or image · Max 10 MB</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#1e2530', marginBottom: '1.5rem' }} />

      {/* Upload areas */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        <UploadArea
          type="transcript"
          label="Transcript"
          description="Official or unofficial · PDF or image"
          docState={docs.transcript}
          onFileSelect={(f) => setFile('transcript', f)}
          onUpload={() => handleUpload('transcript')}
        />
        <UploadArea
          type="test_scores"
          label="Test Scores (SAT / ACT)"
          description="Score report from College Board or ACT"
          docState={docs.test_scores}
          onFileSelect={(f) => setFile('test_scores', f)}
          onUpload={() => handleUpload('test_scores')}
        />
      </div>

      {/* Verified banner — shown once both documents have been successfully uploaded */}
      {uploadedCount === 2 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          marginTop: '1.25rem', padding: '1rem 1.25rem',
          backgroundColor: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '0.6rem',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.15rem' }}>
              🎉 Profile Verified!
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>
              Your Diamond Verified badge is now active on your public profile.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
