'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BG, BG2, BORDER, GOLD, BLUE, TEXT, MUTED, SUBTLE, SERIF, MONO,
} from '@/lib/marketing-tokens';

// ── Local primitives ─────────────────────────────────────────────────────────

function Label({ children, color = MUTED }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{
      fontFamily: MONO,
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color,
      margin: '0 0 0.75rem',
    }}>
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: SERIF,
      fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
      fontWeight: 700,
      color: TEXT,
      margin: '0 0 1rem',
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
    }}>
      {children}
    </h2>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginBottom: '0.6rem', listStyle: 'none' }}>
      <span style={{ color: BLUE, flexShrink: 0, marginTop: '0.1rem', fontFamily: MONO }}>&#9670;</span>
      <span style={{ color: MUTED, fontSize: '0.95rem', lineHeight: 1.6 }}>{children}</span>
    </li>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: BORDER, margin: '0 auto', maxWidth: '1100px' }} />;
}

// ── Waitlist form ────────────────────────────────────────────────────────────

type FormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [state, setState] = useState<FormState>({ status: 'idle' });

  async function handleSubmit() {
    if (state.status === 'submitting') return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setState({ status: 'error', message: 'Email is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setState({ status: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setState({ status: 'submitting' });

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          name: name.trim() || undefined,
          organization: organization.trim() || undefined,
          source: 'college_coach_portal',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          status: 'error',
          message: (data && typeof data.error === 'string') ? data.error : 'Something went wrong. Please try again.',
        });
        return;
      }
      setState({ status: 'success' });
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: '6px',
    color: TEXT,
    padding: '0.75rem 0.85rem',
    fontSize: '0.95rem',
    fontFamily: SERIF,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: MUTED,
    display: 'block',
    marginBottom: '0.45rem',
  };

  if (state.status === 'success') {
    return (
      <div style={{
        background: BG2,
        border: `1px solid ${BLUE}`,
        borderRadius: '10px',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: MONO,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: BLUE,
          margin: '0 0 0.75rem',
        }}>
          You&apos;re on the list
        </p>
        <p style={{ color: TEXT, fontFamily: SERIF, fontSize: '1.15rem', margin: '0 0 0.5rem' }}>
          We&apos;ll email you when it launches.
        </p>
        <p style={{ color: MUTED, fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
          Confirmation sent to <span style={{ color: TEXT }}>{email.trim()}</span>.
        </p>
      </div>
    );
  }

  const submitting = state.status === 'submitting';

  return (
    <div style={{
      background: BG2,
      border: `1px solid ${BORDER}`,
      borderRadius: '10px',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    }}>

      <div>
        <label style={labelStyle} htmlFor="waitlist-email">Email *</label>
        <input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@university.edu"
          autoComplete="email"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="waitlist-name">Name (optional)</label>
        <input
          id="waitlist-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          autoComplete="name"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="waitlist-org">School / Program (optional)</label>
        <input
          id="waitlist-org"
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="State University Baseball"
          autoComplete="organization"
          style={inputStyle}
        />
      </div>

      {state.status === 'error' && (
        <p style={{
          margin: 0,
          padding: '0.65rem 0.85rem',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '0.85rem',
        }}>
          {state.message}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          background: submitting ? '#1e3a8a' : BLUE,
          color: '#000',
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: '0.85rem',
          letterSpacing: '0.06em',
          padding: '0.85rem 1.5rem',
          borderRadius: '6px',
          border: 'none',
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          transition: 'background 0.15s',
        }}
      >
        {submitting ? 'Joining…' : 'Join the Waitlist'}
      </button>

      <p style={{ color: SUBTLE, fontFamily: MONO, fontSize: '0.7rem', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
        No spam. One email when the portal launches.
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WaitlistClient() {
  return (
    <div style={{ background: BG, color: TEXT, fontFamily: SERIF, overflowX: 'hidden', minHeight: '100vh' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,17,23,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: GOLD, fontSize: '1.3rem', lineHeight: 1 }}>&#11041;</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.08em', color: TEXT }}>
            DIAMOND VERIFIED
          </span>
        </Link>
        <Link href="/sign-in" style={{
          fontFamily: MONO,
          fontSize: '0.82rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: MUTED,
          textDecoration: 'none',
          padding: '0.5rem 1rem',
          border: `1px solid ${BORDER}`,
          borderRadius: '4px',
        }}>
          Sign In
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: 'clamp(4rem, 8vw, 7rem) 1.5rem clamp(2rem, 4vw, 3rem)',
        textAlign: 'center',
      }}>
        <Label color={BLUE}>For College Coaches &middot; Coming soon</Label>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          color: TEXT,
          margin: '0 0 1.25rem',
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          maxWidth: '820px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          The verified recruiting portal for college programs
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.15rem)',
          color: MUTED,
          maxWidth: '620px',
          margin: '0 auto',
          lineHeight: 1.7,
        }}>
          Diamond Verified is building a dedicated portal for college coaches.
          Search high school athletes whose metrics have been recorded on video
          and AI-reviewed for legitimacy — not self-reported. Launching in a
          future release. Get on the list to know the moment it goes live.
        </p>
      </section>

      <Divider />

      {/* ── Value prop ──────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: 'clamp(3rem, 6vw, 5rem) 1.5rem',
      }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'start' }}>

          <div>
            <Label color={BLUE}>What you&apos;ll get</Label>
            <SectionHeading>Recruit with verified truth</SectionHeading>
            <p style={{ color: MUTED, fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
              Every athlete you see in the portal has had their key metrics
              captured on video by a Diamond Verified coach, then passed an AI
              legitimacy review. No padded 60s, no inflated exit velo.
            </p>
          </div>

          <div>
            <ul style={{ margin: 0, padding: 0 }}>
              <Bullet>Search by position, stats, GPA, grad year, and location</Bullet>
              <Bullet>View AI-generated scout assessments on each prospect</Bullet>
              <Bullet>See the original verification video for any metric</Bullet>
              <Bullet>Save prospects to lists and track them across the cycle</Bullet>
              <Bullet>Filter to athletes actively looking for programs at your level</Bullet>
            </ul>
          </div>

        </div>
      </section>

      <Divider />

      {/* ── Waitlist capture ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '720px', margin: '0 auto',
        padding: 'clamp(3rem, 6vw, 5rem) 1.5rem',
      }}>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Label color={BLUE}>Get early access</Label>
          <SectionHeading>Join the waitlist</SectionHeading>
          <p style={{ color: MUTED, fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
            We&apos;ll email you as soon as the college coach portal opens.
            No marketing blasts in the meantime.
          </p>
        </div>

        <WaitlistForm />
      </section>

      <Divider />

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: '2.5rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: GOLD, fontSize: '1.1rem' }}>&#11041;</span>
          <span style={{ fontFamily: MONO, fontSize: '0.8rem', fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>
            DIAMOND VERIFIED
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: '0.75rem', color: SUBTLE, margin: 0 }}>
          &copy; 2026 Diamond Verified
        </p>
        <Link href="/" style={{ fontFamily: MONO, fontSize: '0.78rem', color: MUTED, textDecoration: 'none' }}>
          &larr; Back to home
        </Link>
      </footer>

    </div>
  );
}
