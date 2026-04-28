import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import VerificationDocuments from './VerificationDocuments';

function UpgradePrompt({ title, description, tier }: { title: string; description: string; tier: 'athlete' | 'athlete_pro' }) {
  const tierLabel = tier === 'athlete' ? 'Athlete ($29.99/mo)' : 'Athlete Pro ($59.99/mo)';
  const tierColor = tier === 'athlete' ? '#e8a020' : '#a855f7';
  return (
    <div style={{ backgroundColor: '#111827', border: `1px solid ${tierColor}33`, borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>🔒</span>
        <h3 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>{title}</h3>
        <span style={{ marginLeft: 'auto', backgroundColor: `${tierColor}22`, color: tierColor, fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', border: `1px solid ${tierColor}44` }}>
          {tierLabel}
        </span>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{description}</p>
      <a href="/pricing" style={{ display: 'inline-block', backgroundColor: tierColor, color: '#000000', fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '0.5rem', textDecoration: 'none', width: 'fit-content' }}>
        Upgrade to Unlock →
      </a>
    </div>
  );
}

export default async function AthleteDashboard() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const firstName = user.firstName ?? user.emailAddresses[0]?.emailAddress.split('@')[0] ?? 'Athlete';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: athlete } = await supabase
    .from('athletes')
    .select('subscription_tier')
    .eq('clerk_user_id', user.id)
    .single();

  const tier = athlete?.subscription_tier ?? 'free';
  const isAthlete = tier === 'athlete' || tier === 'athlete_pro';
  const isAthletePro = tier === 'athlete_pro';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Welcome back, {firstName} 👋
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Here&apos;s an overview of your recruiting profile.
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Profile Completion', value: '0%',   sub: 'Fill out your profile' },
            { label: 'School Matches',      value: '—',    sub: 'Add your stats first' },
            { label: 'Coaches Contacted',   value: '0',    sub: 'Start reaching out' },
            { label: 'Profile Views',       value: '0',    sub: 'This month' },
          ].map((card) => (
            <div key={card.label} style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {card.label}
              </p>
              <p style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.2rem' }}>
                {card.value}
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.78rem', margin: 0 }}>
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Get started */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
            Get started
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { step: '1', text: 'Complete your athlete profile with stats and academics', done: false },
              { step: '2', text: 'Browse school matches based on your profile',           done: false },
              { step: '3', text: 'Use the calculator to estimate your fit score',         done: false },
            ].map((item) => (
              <div key={item.step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: item.done ? '#e8a020' : 'transparent',
                  border: `2px solid ${item.done ? '#e8a020' : '#374151'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done
                    ? <span style={{ color: '#000', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>
                    : <span style={{ color: '#4b5563', fontSize: '0.7rem', fontWeight: 600 }}>{item.step}</span>
                  }
                </div>
                <p style={{ color: item.done ? '#4b5563' : '#d1d5db', fontSize: '0.875rem', margin: 0, textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Scout Report */}
        <div style={{ marginBottom: '1.25rem' }}>
          {isAthlete ? (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>🤖 AI Scout Report</h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Your AI scout report will appear here once your profile is complete.</p>
            </div>
          ) : (
            <UpgradePrompt
              title="AI Scout Report"
              description="Get a personalized AI-generated scouting report based on your stats, academics, and athletic profile. See exactly how college coaches will evaluate you."
              tier="athlete"
            />
          )}
        </div>

        {/* Development Roadmap */}
        <div style={{ marginBottom: '1.25rem' }}>
          {isAthletePro ? (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>🗺️ Development Roadmap</h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Your personalized development roadmap will appear here.</p>
            </div>
          ) : (
            <UpgradePrompt
              title="Development Roadmap"
              description="Get a custom step-by-step plan to improve your recruiting profile, including skill benchmarks, academic targets, and recruiting timeline milestones."
              tier="athlete_pro"
            />
          )}
        </div>

        {/* PDF & Email Share */}
        <div style={{ marginBottom: '1.25rem' }}>
          {isAthletePro ? (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>📤 Share Your Profile</h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>PDF download and email sharing are available from your public profile page.</p>
            </div>
          ) : (
            <UpgradePrompt
              title="PDF Download & Email Sharing"
              description="Download a professional PDF of your recruiting profile and send it directly to coaches via email — all from your dashboard."
              tier="athlete_pro"
            />
          )}
        </div>

        <VerificationDocuments clerkUserId={user.id} />
      </main>
    </div>
  );
}
