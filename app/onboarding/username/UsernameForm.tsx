'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { validateUsername } from '@/lib/username-validation';
import { checkUsernameAvailable, setUsername } from './actions';

type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken' };

export default function UsernameForm({ suggested }: { suggested: string }) {
  const router = useRouter();

  const [value, setValue] = useState(suggested);
  const [avail, setAvail] = useState<Availability>({ state: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Monotonic token so a slow availability response can't overwrite a newer one.
  const reqToken = useRef(0);

  const lowered = value.toLowerCase();
  const validation = validateUsername(lowered);

  // Debounced availability check (300ms). Only runs when client-side
  // validation passes — no point probing malformed input.
  useEffect(() => {
    if (!validation.valid) {
      setAvail({ state: 'idle' });
      return;
    }

    setAvail({ state: 'checking' });
    const token = ++reqToken.current;
    const t = setTimeout(async () => {
      const { available } = await checkUsernameAvailable(lowered);
      if (token !== reqToken.current) return; // stale response
      setAvail({ state: available ? 'available' : 'taken' });
    }, 300);

    return () => clearTimeout(t);
  }, [lowered, validation.valid]);

  const canSubmit =
    validation.valid && avail.state === 'available' && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await setUsername(lowered);
      if (result.ok) {
        router.push('/dashboard/athlete');
      } else {
        setSubmitError(result.error);
        setSubmitting(false);
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Status line under the input ──────────────────────────────────────────────
  let status: { text: string; color: string } | null = null;
  if (!validation.valid) {
    status = { text: validation.reason ?? 'Invalid username.', color: '#fca5a5' };
  } else if (avail.state === 'checking') {
    status = { text: 'Checking…', color: '#9ca3af' };
  } else if (avail.state === 'available') {
    status = { text: 'Available', color: '#86efac' };
  } else if (avail.state === 'taken') {
    status = { text: 'Already taken', color: '#fca5a5' };
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
    >
      <input
        type="text"
        value={value}
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => setValue(e.target.value.toLowerCase())}
        placeholder="your_handle"
        style={{
          backgroundColor: '#1f2937',
          color: '#ffffff',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          border: '1px solid #374151',
          outline: 'none',
          fontSize: '1rem',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {/* Live URL preview */}
      <p
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#6b7280',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        diamondverified.app/profile/
        <span style={{ color: '#f59e0b' }}>{lowered || 'your_handle'}</span>
      </p>

      {status && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: status.color }}>
          {status.text}
        </p>
      )}

      <p
        style={{
          margin: 0,
          fontSize: '0.8rem',
          color: '#9ca3af',
          lineHeight: 1.5,
        }}
      >
        This is your handle — it&apos;s part of your shareable profile URL. You
        can&apos;t change it later, so pick carefully.
      </p>

      {submitError && (
        <div
          style={{
            backgroundColor: '#450a0a',
            border: '1px solid #991b1b',
            borderRadius: '0.5rem',
            padding: '0.65rem 0.85rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          backgroundColor: canSubmit ? '#2563eb' : '#374151',
          color: '#ffffff',
          fontWeight: 600,
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          fontSize: '1rem',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Saving…' : 'Claim username'}
      </button>
    </form>
  );
}
