import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import AthleteSidebar from '@/components/layout/AthleteSidebar';

export const dynamic = 'force-dynamic';

const TIER_META: Record<string, { label: string; color: string; desc: string }> = {
  free:        { label: 'Free',        color: '#6b7280', desc: 'Basic profile + public metrics page' },
  athlete:     { label: 'Athlete',     color: '#e8a020', desc: 'Coach verifications + school matching' },
  athlete_pro: { label: 'Athlete Pro', color: '#a855f7', desc: 'Priority matching + advanced analytics' },
  coach:       { label: 'Coach',       color: '#58a6ff', desc: 'Coach portal access' },
};

export default async function AthleteSettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const email = user.emailAddresses[0]?.emailAddress ?? '';

  const db = createAdminClient();
  const { data: athlete } = await db
    .from('athletes')
    .select('subscription_tier')
    .eq('clerk_user_id', user.id)
    .maybeSingle();

  const tier    = athlete?.subscription_tier ?? 'free';
  const tierMeta = TIER_META[tier] ?? TIER_META.free;
  const isFree  = tier === 'free';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Manage your account and subscription
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>

          {/* Account section */}
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Account</h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500, margin: '0 0 0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Email
                </p>
                <p style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                  {email}
                </p>
              </div>
              <a
                href="/user-profile"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #1e2530',
                  borderRadius: '0.5rem',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '0.5rem 1.1rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
              >
                Manage Account
              </a>
            </div>
          </div>

          {/* Subscription section */}
          <div style={{ backgroundColor: '#111827', border: `1px solid ${tierMeta.color}33`, borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Subscription</h2>
              <span style={{
                backgroundColor: `${tierMeta.color}22`,
                border: `1px solid ${tierMeta.color}44`,
                borderRadius: '999px',
                color: tierMeta.color,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '0.2rem 0.7rem',
                textTransform: 'uppercase',
              }}>
                {tierMeta.label}
              </span>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              {tierMeta.desc}
            </p>

            {isFree && (
              <>
                <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    'Coach-verified metric badges on your profile',
                    'School match analysis based on your stats',
                    'Priority placement in recruiter searches',
                  ].map(feat => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ color: '#e8a020', fontSize: '0.9rem' }}>◆</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{feat}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="/pricing"
                  style={{
                    backgroundColor: '#e8a020',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#000000',
                    cursor: 'pointer',
                    display: 'inline-block',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    padding: '0.6rem 1.5rem',
                    textDecoration: 'none',
                    width: 'fit-content',
                  }}
                >
                  Upgrade Plan →
                </a>
              </>
            )}

            {!isFree && (
              <div style={{ borderTop: '1px solid #1e2530', paddingTop: '1rem' }}>
                <a
                  href="/pricing"
                  style={{ color: '#6b7280', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 500 }}
                >
                  View all plans →
                </a>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
