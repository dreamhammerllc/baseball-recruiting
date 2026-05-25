'use client';

import { useState, useRef } from 'react';

interface ReadoutUploadProps {
  onUploadComplete: (url: string) => void;
  onError: (msg: string) => void;
  /**
   * Optional — called when the user clicks Remove on the success state, so the
   * parent can clear any URL it had stored from the previous upload. The
   * component reverts to the drop-zone state either way.
   */
  onRemove?: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — server-side cap is authoritative

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export default function ReadoutUpload({ onUploadComplete, onError, onRemove }: ReadoutUploadProps) {
  const [dragOver, setDragOver]             = useState(false);
  const [, setSelectedFile]                 = useState<File | null>(null);
  const [isUploading, setIsUploading]       = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [progress, setProgress]             = useState(0);
  const [error, setError]                   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      handleUpload(file);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      handleUpload(file);
    }
  }

  function handleRemove() {
    setSelectedFile(null);
    setUploadComplete(false);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onRemove?.();
  }

  // Auto-triggered immediately after file selection. Takes `file` as a param so
  // it doesn't depend on `selectedFile` state (which hasn't committed yet at the
  // moment the trigger fires from the change/drop handler closure).
  function handleUpload(file: File) {
    // Validate up front — invalid files never enter the upload pipeline.
    if (!ALLOWED_MIME.has(file.type)) {
      onError('Unsupported file type. Please upload a PDF or image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onError('File exceeds the 10 MB size limit. Please choose a smaller file.');
      return;
    }

    setIsUploading(true);
    setUploadComplete(false);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/coach/upload-readout');

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { success?: boolean; url?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.success && data.url) {
          setUploadComplete(true);
          setIsUploading(false);
          onUploadComplete(data.url);
        } else {
          const msg = data.error ?? `Upload failed (HTTP ${xhr.status}).`;
          setError(msg);
          onError(msg);
          setIsUploading(false);
        }
      } catch {
        const msg = `Upload failed (HTTP ${xhr.status}).`;
        setError(msg);
        onError(msg);
        setIsUploading(false);
      }
    };

    xhr.onerror = () => {
      const msg = 'Upload failed: network error.';
      setError(msg);
      onError(msg);
      setIsUploading(false);
    };

    xhr.send(formData);
  }

  if (uploadComplete) {
    return (
      <div style={{ border: '2px dashed #1e2530', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#10003;</div>
        <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
          Upload complete
        </span>
        <button
          type="button"
          onClick={handleRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '0.78rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Remove or replace
        </button>
      </div>
    );
  }

  if (isUploading) {
    return (
      <div style={{ border: '2px dashed #1e2530', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#e8a020', fontWeight: 600, fontSize: '0.95rem', margin: '0 0 0.75rem' }}>
          Uploading{progress > 0 ? ` ${progress}%` : '...'}
        </p>
        {/* Progress bar */}
        <div style={{ backgroundColor: '#1e2530', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: '#e8a020',
            borderRadius: '9999px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Drop zone — initial state. File selection auto-triggers the upload, so
          there is no separate "selected but not uploading" intermediate state. */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#e8a020' : '#1e2530'}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          background: dragOver ? 'rgba(232,160,32,0.04)' : 'transparent',
        }}
        onMouseEnter={e => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#e8a020'; }}
        onMouseLeave={e => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2530'; }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        <div style={{ marginBottom: '0.75rem' }}>
          {/* Document-outline icon — same style as ProofUpload */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8"  y1="13" x2="16" y2="13" />
            <line x1="8"  y1="17" x2="16" y2="17" />
            <line x1="8"  y1="9"  x2="10" y2="9"  />
          </svg>
        </div>
        <p style={{ color: '#6b7280', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>
          Drag and drop a PDF or image
        </p>
        <p style={{ color: '#4b5563', margin: 0, fontSize: '0.78rem' }}>
          or click to browse &mdash; max 10 MB
        </p>
      </div>

      {error && <div style={{ color: '#f87171', marginTop: '8px', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}
