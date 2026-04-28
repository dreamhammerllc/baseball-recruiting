'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { promoteRole } from './actions';

const ROLES = [
  { value: 'athlete',       label: 'Athlete',          description: 'High school or college athlete looking to get recruited.' },
  { value: 'hs_coach',      label: 'High School Coach', description: 'Coach a high school team and help players get recruited.' },
  { value: 'college_coach', label: 'College Coach',     description: 'Recruit athletes for a college program.' },
] as const;
type Role = typeof ROLES[number]['value'];

type UIState =
  | { screen: 'loading'; message: string }
  | { screen: 'pick-role' }
  | { screen: 'error'; message: string };

export default function OnboardingPage() {
  const { isLoaded, user } = useUser();
  const { session } = useClerk();
  const router = useRouter();
  const ran = useRef(false);

  const [ui, setUI] = useState<UIState>({ screen: 'loading', message: 'Loading your account…' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      setUI({ screen: 'loading', message: 'Connecting to Clerk…' });
      return;
    }
    if (!user) {
      router.push('/sign-in');
      return;
    }
    if (ran.current) return;
    ran.current = true;

    const role = user.unsafeMetadata?.role as string | undefined;

    if (!role) {
      // No role saved from sign-up (e.g. old test account) — let user pick
      setUI({ screen: 'pick-role' });
      return;
    }

    void runPromotion(role);
  }, [isLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runPromotion(role: string) {
    setUI({ screen: 'loading', message: `Found role: ${role}. Saving your profile…` });
    try {
      const destination = await promoteRole(role);
      setUI({ screen: 'loading', message: 'Profile saved. Refreshing session…' });
      await session?.reload();
      setUI({ screen: 'loading', message: 'Redirecting to your dashboard…' });
      router.push(destination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUI({ screen: 'error', message: msg });
    }
  }

  async function handleRolePick(role: Role) {
    setSaving(true);
    try {
      // Persist role to unsafeMetadata first so it survives refreshes
      await user!.update({ unsafeMetadata: { role } });
      await runPromotion(role);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUI({ screen: 'error', message: msg });
      setSaving(false);
    }
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (ui.screen === 'loading') {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <p style={{ color: '#d1d5db', fontSize: '0.95rem', margin: 0, textAlign: 'center' }}>
            {ui.message}
          </p>
          <Spinner />
        </div>
      </main>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  if (ui.screen === 'error') {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <div style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.875rem', textAlign: 'center' }}>
            Error: {ui.message}
          </div>
          <button
            onClick={() => { ran.current = false; setUI({ screen: 'loading', message: 'Retrying…' }); router.refresh(); }}
            style={styles.btn}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // ── Role picker (fallback for accounts without a saved role) ─────────────────
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Logo />
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', margin: 0 }}>
          We couldn&apos;t find a role for your account. Please select one to continue.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={saving}
              onClick={() => handleRolePick(r.value)}
              style={{
                textAlign: 'left',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '2px solid #374151',
                backgroundColor: '#1f2937',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                width: '100%',
              }}
            >
              <p style={{ color: '#f3f4f6', fontWeight: 600, margin: 0 }}>{r.label}</p>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{r.description}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function Logo() {
  return (
    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.025em', textAlign: 'center' }}>
      Diamond Verified
    </h1>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712',
    padding: '1rem',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#111827',
    borderRadius: '1rem',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
  } as React.CSSProperties,
  btn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
    padding: '0.65rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
  } as React.CSSProperties,
};
