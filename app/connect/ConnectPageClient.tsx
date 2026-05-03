'use client';

import { useRouter } from 'next/navigation';

type Status = 'connected' | 'already_connected' | 'invalid' | 'error';

interface Props {
  status: Status;
  athleteName: string;
}

export default function ConnectPageClient({ status, athleteName }: Props) {
  const router = useRouter();

  const config: Record<Status, { icon: string; iconColor: string; heading: string; body: string; cta: string }> = {
    connected: {
      icon: '✓',
      iconColor: '#22c55e',
      heading: 'Athlete Added',
      body: `${athleteName} has been added to your roster. You can now verify their metrics.`,
      cta: 'View My Athletes',
    },
    already_connected: {
      icon: '✓',
      iconColor: '#58a6ff',
      heading: 'Already Connected',
      body: `${athleteName} is already on your roster.`,
      cta: 'View My Athletes',
    },
    invalid: {
      icon: '✕',
      iconColor: '#ef4444',
      heading: 'Invalid Link',
      body: 'This connection link is invalid or the athlete no longer exists. Ask the athlete to share their link again.',
      cta: 'Go to Dashboard',
    },
    error: {
      icon: '!',
      iconColor: '#f59e0b',
      heading: 'Something Went Wrong',
      body: 'We could not complete the connection. Please try again or use the Add Athlete button on your dashboard.',
      cta: 'Go to Dashboard',
    },
  };

  const c = config[status];
  const destination = status === 'connected' || status === 'already_connected'
    ? '/dashboard/coach/athletes'
    : '/dashboard/coach';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1e2530',
        borderRadius: '1rem',
        padding: '2.5rem',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{ color: '#e8a020', fontWeight: 800, fontSize: '1rem', margin: '0 0 2rem', letterSpacing: '-0.01em' }}>
          Diamond Verified
        </p>

        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          backgroundColor: `${c.iconColor}18`,
          border: `2px solid ${c.iconColor}`,
          margin: '0 auto 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem', color: c.iconColor, fontWeight: 700,
        }}>
          {c.icon}
        </div>

        <h1 style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.6rem' }}>
          {c.heading}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 2rem', lineHeight: 1.6 }}>
          {c.body}
        </p>

        <button
          onClick={() => router.push(destination)}
          style={{
            backgroundColor: '#e8a020',
            color: '#000000',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {c.cta}
        </button>
      </div>
    </div>
  );
}
