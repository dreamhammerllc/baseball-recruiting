'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  athleteName: string;
  position: string | null;
  gradYear: string | null;
  profileUrl: string;
  topFitScore: number | null;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ShareEmailButton({
  athleteName,
  position,
  gradYear,
  profileUrl,
  topFitScore,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input whenever the form opens
  useEffect(() => {
    if (open && status !== 'success') {
      inputRef.current?.focus();
    }
  }, [open, status]);

  function handleToggle() {
    if (status === 'success') return; // keep confirmation visible, don't re-open
    setOpen((prev) => !prev);
    setStatus('idle');
    setErrorMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/share-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachEmail: email.trim(),
          athleteName,
          profileUrl,
          position,
          gradYear,
          fitScore: topFitScore,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus('error');
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setStatus('success');
        setEmail('');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  }

  function handleCancel() {
    setOpen(false);
    setStatus('idle');
    setEmail('');
    setErrorMsg('');
  }

  const isSuccess = status === 'success';

  return (
    <div>
      {/* Trigger button */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          padding: '0.85rem',
          backgroundColor: isSuccess ? 'rgba(16,185,129,0.1)' : open ? 'rgba(232,160,32,0.06)' : 'transparent',
          border: `1px solid ${isSuccess ? '#10b981' : open ? '#e8a020' : '#1e2530'}`,
          borderRadius: open && !isSuccess ? '0.75rem 0.75rem 0 0' : '0.75rem',
          color: isSuccess ? '#10b981' : open ? '#e8a020' : '#9ca3af',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: isSuccess ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.15s ease',
        }}
      >
        {isSuccess ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Email Sent!
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Share via Email
          </>
        )}
      </button>

      {/* Inline form — expands below the button */}
      {open && !isSuccess && (
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #e8a020',
          borderTop: 'none',
          borderRadius: '0 0 0.75rem 0.75rem',
          padding: '1rem 1rem 1rem',
        }}>
          <p style={{
            margin: '0 0 0.75rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            lineHeight: 1.5,
          }}>
            Enter a coach&apos;s email address to send them a link to this profile.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: errorMsg ? '0.5rem' : '0.65rem' }}>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') { setStatus('idle'); setErrorMsg(''); }
                }}
                placeholder="coach@school.edu"
                disabled={status === 'loading'}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.85rem',
                  backgroundColor: '#0d1117',
                  border: `1px solid ${status === 'error' ? '#ef4444' : '#1e2530'}`,
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#e8a020'; }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = status === 'error' ? '#ef4444' : '#1e2530';
                }}
              />
              <button
                type="submit"
                disabled={!email.trim() || status === 'loading'}
                style={{
                  padding: '0.6rem 1.1rem',
                  backgroundColor: (!email.trim() || status === 'loading') ? 'rgba(232,160,32,0.3)' : '#e8a020',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: (!email.trim() || status === 'loading') ? 'rgba(10,14,20,0.5)' : '#0a0e14',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: (!email.trim() || status === 'loading') ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {status === 'loading' ? 'Sending…' : 'Send'}
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <p style={{
                margin: '0 0 0.65rem',
                fontSize: '0.75rem',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMsg}
              </p>
            )}

            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: '#4b5563',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
