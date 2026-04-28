'use client';

import { useAuth } from '@clerk/nextjs';
import { useSignUp } from '@clerk/nextjs/legacy';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = [
  { value: 'athlete', label: 'Athlete', description: 'High school or college athlete looking to get recruited.' },
  { value: 'hs_coach', label: 'High School Coach', description: 'Coach a high school team and help players get recruited.' },
  { value: 'college_coach', label: 'College Coach', description: 'Recruit athletes for a college program.' },
] as const;

type Role = typeof ROLES[number]['value'];
type Step = 'details' | 'verify';

export default function SignUpPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>('details');
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isReady = authLoaded && signUpLoaded;

  // If already signed in, redirect to onboarding
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.push('/onboarding');
    }
  }, [authLoaded, isSignedIn, router]);

  async function handleCreate() {
    if (!signUp) return;
    if (!role) { setError('Please select a role before continuing.'); return; }
    if (!email) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter a password.'); return; }

    setLoading(true);
    setError('');

    try {
      await signUp.create({ emailAddress: email, password, unsafeMetadata: { role } });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUp || !setActive) return;
    if (code.length < 6) { setError('Please enter the 6-digit code from your email.'); return; }

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/onboarding');
      } else {
        setError('Verification incomplete — please try again.');
      }
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function extractError(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (Array.isArray(e.errors) && e.errors.length > 0) {
        return (e.errors[0] as { message: string }).message;
      }
      if (typeof e.message === 'string') return e.message;
    }
    return 'Something went wrong. Please try again.';
  }

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: '448px',
    backgroundColor: '#111827',
    borderRadius: '1rem',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  };

  // Loading state while Clerk initializes
  if (!isReady) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712' }}>
        <div style={card}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Diamond Verified</h1>
            <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.875rem' }}>Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030712', padding: '1rem' }}>
      <div style={card}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>Diamond Verified</h1>
          <p style={{ color: '#9ca3af', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            {step === 'details' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {step === 'details' ? (
          <>
            {/* Role selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>I am a…</p>
              {ROLES.map((r) => {
                const selected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => { setRole(r.value); setError(''); }}
                    style={{
                      textAlign: 'left',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: selected ? '2px solid #f59e0b' : '2px solid #374151',
                      backgroundColor: selected ? '#1c1202' : '#1f2937',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <p style={{ color: selected ? '#fbbf24' : '#f3f4f6', fontWeight: 600, margin: 0 }}>{r.label}</p>
                    <p style={{ color: selected ? '#d97706' : '#9ca3af', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{r.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Email & Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ backgroundColor: '#1f2937', color: '#ffffff', borderRadius: '0.5rem', padding: '0.75rem 1rem', border: '1px solid #374151', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ backgroundColor: '#1f2937', color: '#ffffff', borderRadius: '0.5rem', padding: '0.75rem 1rem', border: '1px solid #374151', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 600, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Already have an account?{' '}
              <a href="/sign-in" style={{ color: '#60a5fa', textDecoration: 'none' }}>Sign in</a>
            </p>
          </>
        ) : (
          <>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', margin: 0 }}>
              We sent a 6-digit code to <span style={{ color: '#ffffff' }}>{email}</span>. Enter it below.
            </p>

            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{ backgroundColor: '#1f2937', color: '#ffffff', borderRadius: '0.5rem', padding: '0.75rem 1rem', border: '1px solid #374151', outline: 'none', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5rem', width: '100%', boxSizing: 'border-box' }}
            />

            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 600, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Verifying…' : 'Verify Email'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('details'); setError(''); setCode(''); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.875rem', cursor: 'pointer', padding: 0 }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </main>
  );
}
