'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
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
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
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
    setUploading(true);
    try {
      // Build a path that encodes upload context so the server can route/store correctly
      const suffix = uploadType === 'metric' && metricKey
        ? `${uploadType}/${metricKey}`
        : uploadType === 'highlight' && slotNumber !== undefined
        ? `${uploadType}/${slotNumber}`
        : uploadType;
      const pathname = `videos/${suffix}/${selectedFile.name}`;

      const blob = await upload(pathname, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/upload-video/blob-token',
      });

      setUploadComplete(true);
      onUploadComplete(blob.url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (uploadComplete) {
    return (
      <div
        style={{
          border: '2px dashed #1e2530',
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#10003;</div>
        <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.95rem' }}>
          Upload complete
        </span>
      </div>
    );
  }

  if (uploading) {
    return (
      <div
        style={{
          border: '2px dashed #1e2530',
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            color: '#e8a020',
            fontWeight: 600,
            fontSize: '0.95rem',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          Uploading...
        </span>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
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
        onMouseEnter={e => {
          if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#e8a020';
        }}
        onMouseLeave={e => {
          if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2530';
        }}
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
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#d4911c';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#e8a020';
            }}
          >
            Upload
          </button>
        </div>
      )}
    </div>
  );
}
