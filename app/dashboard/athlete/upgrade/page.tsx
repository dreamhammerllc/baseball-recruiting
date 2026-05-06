'use client'

import { useState } from 'react'
import AthleteSidebar from '@/components/layout/AthleteSidebar'


const colors = {
  bg:      '#0d1117',
  surface: '#111827',
  border:  '#1e2530',
  gold:    '#e8a020',
  blue:    '#58a6ff',
  text:    '#f0f6fc',
  muted:   '#6b7280',
}

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleUpgrade(tier: string, period: string) {
    setLoading(`${tier}:${period}`)
    setError(null)
    try {
      const res  = await fetch('/api/stripe/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier, period }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Could not start checkout. Please try again.')
        setLoading(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.18em', color: colors.gold, textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            &#9670; Diamond Verified
          </p>
          <h1 style={{ color: colors.text, fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            Upgrade Your Profile
          </h1>
          <p style={{ color: colors.muted, fontSize: '0.9rem', margin: 0, maxWidth: '520px' }}>
            Stand out to college coaches. Choose a plan and get your verified badge today.
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#f87171', fontSize: '0.875rem', fontFamily: 'monospace' }}>
            {error}
          </div>
        )}

        {/* Pricing cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', maxWidth: '780px' }}>

          {/* Verified tier */}
          <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.gold}`, borderRadius: '1rem', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: colors.gold, fontSize: '1rem' }}>&#9670;</span>
                <h2 style={{ color: colors.text, fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
                  Verified
                </h2>
              </div>
              <p style={{ color: colors.muted, fontSize: '0.8rem', margin: 0 }}>
                Get your verified badge and make your profile stand out to coaches.
              </p>
            </div>

            <div>
              <p style={{ color: colors.text, fontSize: '2rem', fontWeight: 800, margin: '0 0 0.1rem', fontFamily: 'monospace' }}>
                $9.99<span style={{ fontSize: '1rem', fontWeight: 400, color: colors.muted }}>/mo</span>
              </p>
              <p style={{ color: colors.muted, fontSize: '0.75rem', margin: 0 }}>or $79/year (save 34%)</p>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                'Verified badge on your public profile',
                'All coach-verified metrics display publicly',
                'Verification videos on public profile',
                'Found by college coaches searching Diamond Verified',
              ].map((feat) => (
                <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: colors.text }}>
                  <span style={{ color: colors.gold, flexShrink: 0, marginTop: '0.1rem' }}>&#10003;</span>
                  {feat}
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: 'auto' }}>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleUpgrade('verified', 'monthly')}
                style={{
                  backgroundColor: loading === 'verified:monthly' ? colors.muted : colors.gold,
                  color:           '#0d1117',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  padding:         '0.75rem 1.25rem',
                  fontWeight:      700,
                  fontSize:        '0.875rem',
                  cursor:          loading !== null ? 'not-allowed' : 'pointer',
                  fontFamily:      'monospace',
                  letterSpacing:   '0.04em',
                }}
              >
                {loading === 'verified:monthly' ? 'Redirecting...' : 'Start Monthly - $9.99/mo'}
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleUpgrade('verified', 'yearly')}
                style={{
                  backgroundColor: 'transparent',
                  color:           colors.gold,
                  border:          `1px solid ${colors.gold}`,
                  borderRadius:    '0.5rem',
                  padding:         '0.75rem 1.25rem',
                  fontWeight:      600,
                  fontSize:        '0.875rem',
                  cursor:          loading !== null ? 'not-allowed' : 'pointer',
                  fontFamily:      'monospace',
                  letterSpacing:   '0.04em',
                }}
              >
                {loading === 'verified:yearly' ? 'Redirecting...' : 'Start Yearly - $79/yr'}
              </button>
            </div>
          </div>

          {/* Elite tier */}
          <div style={{ backgroundColor: colors.surface, border: `1px solid ${colors.blue}`, borderRadius: '1rem', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: colors.blue, color: '#0d1117', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
              BEST VALUE
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: colors.blue, fontSize: '1rem' }}>&#11088;</span>
                <h2 style={{ color: colors.text, fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
                  Elite
                </h2>
              </div>
              <p style={{ color: colors.muted, fontSize: '0.8rem', margin: 0 }}>
                Everything in Verified plus the School Matches calculator to find your best fits.
              </p>
            </div>

            <div>
              <p style={{ color: colors.text, fontSize: '2rem', fontWeight: 800, margin: '0 0 0.1rem', fontFamily: 'monospace' }}>
                $19.99<span style={{ fontSize: '1rem', fontWeight: 400, color: colors.muted }}>&#47;mo</span>
              </p>
              <p style={{ color: colors.muted, fontSize: '0.75rem', margin: 0 }}>or $159/year (save 34%)</p>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                'Everything in Verified',
                'School Matches calculator unlocked',
                'Save up to 50 school matches',
                'Priority profile placement',
              ].map((feat) => (
                <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: colors.text }}>
                  <span style={{ color: colors.blue, flexShrink: 0, marginTop: '0.1rem' }}>&#10003;</span>
                  {feat}
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: 'auto' }}>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleUpgrade('elite', 'monthly')}
                style={{
                  backgroundColor: loading === 'elite:monthly' ? colors.muted : colors.blue,
                  color:           '#0d1117',
                  border:          'none',
                  borderRadius:    '0.5rem',
                  padding:         '0.75rem 1.25rem',
                  fontWeight:      700,
                  fontSize:        '0.875rem',
                  cursor:          loading !== null ? 'not-allowed' : 'pointer',
                  fontFamily:      'monospace',
                  letterSpacing:   '0.04em',
                }}
              >
                {loading === 'elite:monthly' ? 'Redirecting...' : 'Start Monthly - $19.99/mo'}
              </button>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleUpgrade('elite', 'yearly')}
                style={{
                  backgroundColor: 'transparent',
                  color:           colors.blue,
                  border:          `1px solid ${colors.blue}`,
                  borderRadius:    '0.5rem',
                  padding:         '0.75rem 1.25rem',
                  fontWeight:      600,
                  fontSize:        '0.875rem',
                  cursor:          loading !== null ? 'not-allowed' : 'pointer',
                  fontFamily:      'monospace',
                  letterSpacing:   '0.04em',
                }}
              >
                {loading === 'elite:yearly' ? 'Redirecting...' : 'Start Yearly - $159/yr'}
              </button>
            </div>
          </div>

        </div>

        {/* Free tier note */}
        <p style={{ color: colors.muted, fontSize: '0.8rem', marginTop: '2rem', fontFamily: 'monospace' }}>
          &#9670; All plans include a basic profile and coach connections. Cancel anytime.
        </p>
      </main>
    </div>
  )
}
