import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import VerificationDocuments from './VerificationDocuments';
import AthleteDashboardMetrics from '@/components/AthleteDashboardMetrics';
import AthleteConnectCard from '@/components/AthleteConnectCard';
import type { AthleteMetric } from '@/lib/metrics';


export default async function AthleteDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params  = await searchParams;
  const upgraded = params.upgraded === 'true';

  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const firstName = user.firstName ?? user.emailAddresses[0]?.emailAddress.split('@')[0] ?? 'Athlete';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch athlete record (profile + subscription)
  const { data: athlete } = await supabase
    .from('athletes')
    .select('subscription_tier, full_name, grad_year, position, gpa_weighted, home_state, bio, photo_url, highlight_video_url')
    .eq('clerk_user_id', user.id)
    .single();

  // Fetch athlete metrics (personal bests only for dashboard summary)
  const { data: metricsData } = await supabase
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', user.id)
    .order('recorded_at', { ascending: false });

  const allMetrics: AthleteMetric[] = (metricsData ?? []) as AthleteMetric[];

  // Fetch school matches count
  const { count: schoolMatchCount } = await supabase
    .from('school_matches')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_clerk_id', user.id);

  const tier      = athlete?.subscription_tier ?? 'free';
  const tierLabel = tier === 'elite' ? 'Elite' : tier === 'verified' ? 'Verified' : 'Scout';

  // Profile completion scoring
  const completionFields = [
    !!athlete?.full_name,
    !!athlete?.grad_year,
    !!athlete?.position,
    !!athlete?.gpa_weighted,
    !!athlete?.home_state,
    !!athlete?.bio,
    !!athlete?.photo_url,
    allMetrics.length > 0,
  ];
  const completionPct = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100
  );

  const hasProfile  = !!athlete?.full_name && !!athlete?.position;
  const hasMatches  = (schoolMatchCount ?? 0) > 0;
  const hasMetrics  = allMetrics.length > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        {/* Upgrade success banner */}
        {upgraded && (
          <div style={{ backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.4)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>&#9670;</span>
            <p style={{ color: '#e8a020', fontSize: '0.9rem', fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>
              Welcome to Diamond Verified {tierLabel}! Your profile is now active.
            </p>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Welcome back, {firstName} &#128075;
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Here&apos;s an overview of your recruiting profile.
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            {
              label: 'Profile Completion',
              value: `${completionPct}%`,
              sub: completionPct === 100 ? 'Profile complete!' : 'Keep filling it out',
              highlight: completionPct === 100,
            },
            {
              label: 'School Matches',
              value: schoolMatchCount != null ? String(schoolMatchCount) : '—',
              sub: hasMatches ? 'View your matches' : 'Add stats to see matches',
              highlight: false,
            },
            {
              label: 'Verified Metrics',
              value: String(allMetrics.filter(m => m.verification_type === 'coach_verified').length),
              sub: 'Coach verified stats',
              highlight: false,
            },
            {
              label: 'Total Metrics',
              value: String(allMetrics.filter(m => m.is_personal_best).length),
              sub: 'Personal bests on file',
              highlight: false,
            },
          ].map((card) => (
            <div key={card.label} style={{
              backgroundColor: '#111827',
              border: `1px solid ${card.highlight ? 'rgba(232,160,32,0.4)' : '#1e2530'}`,
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {card.label}
              </p>
              <p style={{ color: card.highlight ? '#e8a020' : '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.2rem' }}>
                {card.value}
              </p>
              <p style={{ color: '#4b5563', fontSize: '0.78rem', margin: 0 }}>
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Upgrade callout for free-tier users */}
        {tier === 'free' && (
          <div style={{ backgroundColor: '#111827', border: '1px solid rgba(232,160,32,0.3)', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ color: '#e8a020', fontWeight: 700, fontSize: '0.9rem', margin: '0 0 0.2rem', fontFamily: 'monospace' }}>&#9670; Unlock Your Full Profile</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Get a verified badge, display your coach-verified metrics, and unlock School Matches.</p>
            </div>
            <a href="/dashboard/athlete/upgrade" style={{ backgroundColor: '#e8a020', color: '#0d1117', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              View Plans &#8594;
            </a>
          </div>
        )}

        {/* Get started checklist */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' }}>
            Get started
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { step: '1', text: 'Complete your athlete profile with stats and academics', done: hasProfile, href: '/dashboard/athlete/profile' },
              { step: '2', text: 'Browse school matches based on your profile',           done: hasMatches, href: '/dashboard/athlete/school-matches' },
              { step: '3', text: 'Add or verify your first metric',                       done: hasMetrics, href: '/dashboard/athlete/metrics' },
            ].map((item) => (
              <a
                key={item.step}
                href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
              >
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
                <p style={{
                  color: item.done ? '#4b5563' : '#d1d5db',
                  fontSize: '0.875rem',
                  margin: 0,
                  textDecoration: item.done ? 'line-through' : 'none',
                }}>
                  {item.text}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* My Metrics — client component with Add/Update modal */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <AthleteDashboardMetrics initialMetrics={allMetrics} />
        </div>

        <AthleteConnectCard athleteId={user.id} />

        <VerificationDocuments clerkUserId={user.id} />
      </main>
    </div>
  );
}
