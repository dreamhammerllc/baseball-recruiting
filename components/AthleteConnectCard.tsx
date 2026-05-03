'use client';

import { useState } from 'react';

interface Props {
  athleteId: string;
}

export default function AthleteConnectCard({ athleteId }: Props) {
  const [copied, setCopied] = useState(false);

  // Last 6 chars of Clerk user ID, uppercased — deterministic invite code
  const inviteCode = athleteId.slice(-6).toUpperCase();
  const connectUrl = `https://diamondverified.app/connect?athlete=${athleteId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=000000&bgcolor=ffffff&data=${encodeURIComponent(connectUrl)}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Connect with me on Diamond Verified',
          text: `Scan my QR code or use invite code ${inviteCode} to add me as your athlete.`,
          url: connectUrl,
        });
      } catch {
        // user cancelled share — no action needed
      }
    } else {
      await navigator.clipboard.writeText(connectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div style={{
      backgroundColor: '#111827',
      border: '1px solid #1e2530',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      marginBottom: '1.25rem',
    }}>
      <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem' }}>
        Connect with a Coach
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
        Show your QR code or share your invite code so a coach can add you to their roster.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>

        {/* QR Code */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.75rem',
          display: 'inline-flex',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="Athlete connection QR code"
            width={180}
            height={180}
            style={{ display: 'block' }}
          />
        </div>

        {/* Invite code */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.72rem', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Invite Code
          </p>
          <p style={{
            color: '#e8a020',
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '0.25em',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {inviteCode}
          </p>
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          style={{
            backgroundColor: '#e8a020',
            color: '#000000',
            fontSize: '0.875rem',
            fontWeight: 700,
            padding: '0.65rem 1.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '220px',
          }}
        >
          {copied ? 'Link Copied!' : 'Share My Link'}
        </button>
      </div>
    </div>
  );
}
