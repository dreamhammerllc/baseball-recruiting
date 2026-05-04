'use client';

import { useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import type { MetricKey } from '@/lib/metrics';

interface VideoUploadProps {
  athleteClerkId: string;
  uploadType: 'metric' | 'highlight';
  metricKey?: MetricKey;
  slotNumber?: number;
  onUploadComplete: (videoUrl: string) => void;
  onError: (msg: string) => void;
}

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function formatFileSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function VideoUpload({
  athleteClerkId: _athleteClerkId,
  uploadType,
  metricKey,
  slotNumber,
  onUploadComplete,
  onError,
}: VideoUploadProps) {
  const [dragOver, setDragOver]         = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [progress, setProgress]         = useState(0);
  const [error, setError]               = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('video/')) {
      onError('Please select a valid video file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onError('File exceeds the 500 MB size limit. Please choose a smaller file.');
      return;
    }
    setSelectedFile(file);
    setUploadComplete(false);
    setProgress(0);
    setError(null);
  }

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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get TUS credentials from server (creates Bunny Stream video entry)
      const tokenRes = await fetch('/api/upload-video/stream-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename:   selectedFile.name,
          uploadType,
          metricKey:  metricKey ?? null,
          slotNumber: slotNumber ?? null,
        }),
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok || token.error) throw new Error(token.error ?? 'Failed to get upload token.');

      const { videoId, libraryId, expirationTime, signature, cdnUrl } = token;

      // Step 2: Upload directly to Bunny Stream via TUS — never touches Vercel with file data
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(selectedFile, {
          endpoint:    'https://video.bunnycdn.com/tusupload',
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire:    String(expirationTime),
            VideoId:                videoId,
            LibraryId:              String(libraryId),
          },
          metadata: {
            filetype: selectedFile.type,
            title:    selectedFile.name,
          },
          onProgress(bytesUploaded, bytesTotal) {
            setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess() { resolve(); },
          onError(err) { reject(err); },
        });
        upload.start();
      });

      // Step 3: Notify parent with the Bunny Stream CDN URL
      setUploadComplete(true);
      onUploadComplete(cdnUrl);

    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
      setIsUploading(false);
    }
  }

  if (uploadComplete) {
    return (
      <div style={{ border: '2px dashed #1e2530', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#10003;</div>
        <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.95rem' }}>
          Upload complete
        </span>
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
      {/* Drop zone */}
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
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {!selectedFile ? (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p style={{ color: '#6b7280', margin: '0 0 0.4rem', fontSize: '0.9rem' }}>
              Drag and drop a video file here
            </p>
            <p style={{ color: '#4b5563', margin: 0, fontSize: '0.78rem' }}>
              or click to browse &mdash; max 500 MB
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.88rem' }}>
              {selectedFile.name}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>
              {formatFileSize(selectedFile.size)}
            </span>
            <span style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: '0.1rem' }}>
              Click to change file
            </span>
          </div>
        )}
      </div>

      {/* Upload button */}
      {selectedFile && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleUpload}
            style={{
              background: '#e8a020',
              border: 'none',
              color: '#0d1117',
              borderRadius: '0.5rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d4911c'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e8a020'; }}
          >
            Upload
          </button>
        </div>
      )}

      {error && <div style={{ color: '#f87171', marginTop: '8px', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}
