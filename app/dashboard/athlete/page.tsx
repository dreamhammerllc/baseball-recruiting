import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import AthleteSidebar from '@/components/layout/AthleteSidebar';
import VerificationDocuments from './VerificationDocuments';
import AthleteDashboardMetrics from '@/components/AthleteDashboardMetrics';
import AthleteConnectCard from '@/components/AthleteConnectCard';
import AthleteVerificationStatus, { type AthleteReviewItem } from '@/components/AthleteVerificationStatus';
import TopPitchVelocityCard from './TopPitchVelocityCard';
import { getHistoryForPitchType, PITCH_TYPE_TO_METRIC_KEY, METRIC_INFO } from '@/lib/metrics';
import type { AthleteMetric, AthletePitch, MetricKey } from '@/lib/metrics';


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

  const db = createAdminClient();

  // Fetch athlete record (profile + subscription)
  const { data: athlete } = await db
    .from('athletes')
    .select('subscription_tier, full_name, grad_year, position, gpa_weighted, home_state, bio, photo_url, highlight_video_url')
    .eq('clerk_user_id', user.id)
    .single();

  // Fetch athlete metrics (personal bests only for dashboard summary)
  const { data: metricsData } = await db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', user.id)
    .order('recorded_at', { ascending: false });

  const allMetrics: AthleteMetric[] = (metricsData ?? []) as AthleteMetric[];

  // Fetch school matches count
  const { count: schoolMatchCount } = await db
    .from('school_matches')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_clerk_id', user.id);

  // Fetch pitching arsenal (full rows feed the Top Pitch Velocity card; the
  // Arsenal stat tile derives its count from the same fetch).
  type TopPitch = Pick<
    AthletePitch,
    'id' | 'pitch_slot' | 'pitch_type' | 'velocity' | 'verification_type' | 'source_label'
  >;
  const { data: pitchesData } = await db
    .from('athlete_pitches')
    .select('id, pitch_slot, pitch_type, velocity, verification_type, source_label')
    .eq('athlete_clerk_id', user.id)
    .order('pitch_slot', { ascending: true });
  const pitches = (pitchesData ?? []) as TopPitch[];
  const arsenalY = pitches.length;

  // Top pitch by velocity; ties broken by lowest pitch_slot (display priority).
  const pitchesWithVelocity = pitches.filter(p => p.velocity != null);
  const topPitch: TopPitch | null = pitchesWithVelocity.length > 0
    ? pitchesWithVelocity.reduce((best, p) =>
        p.velocity! > best.velocity! ||
        (p.velocity! === best.velocity! && p.pitch_slot < best.pitch_slot)
          ? p
          : best,
      )
    : null;

  const topPitchMetricKey: MetricKey | null = topPitch
    ? (PITCH_TYPE_TO_METRIC_KEY[topPitch.pitch_type] ?? null)
    : null;
  const topPitchHistory: AthleteMetric[] = topPitch
    ? getHistoryForPitchType(allMetrics, topPitch.pitch_type)
    : [];

  // Coach-submitted metrics still under review or rejected (athlete-facing status)
  const { data: reviewSessions } = await db
    .from('metric_sessions')
    .select('id, coach_clerk_id, metric_key, claimed_value, status, decision_reason, review_note, review_requested, created_at')
    .eq('athlete_clerk_id', user.id)
    .in('status', ['flagged', 'rejected'])
    .order('created_at', { ascending: false });
  const reviewRows = (reviewSessions ?? []) as any[];

  const reviewCoachIds = Array.from(new Set(reviewRows.map(r => r.coach_clerk_id).filter(Boolean)));
  const reviewCoachNames: Record<string, string> = {};
  if (reviewCoachIds.length > 0) {
    const { data: reviewCoaches } = await db
      .from('coaches')
      .select('clerk_user_id, full_name, organization')
      .in('clerk_user_id', reviewCoachIds);
    for (const c of reviewCoaches ?? []) {
      reviewCoachNames[c.clerk_user_id] = c.organization ? `${c.full_name} (${c.organization})` : c.full_name;
    }
  }

  const verificationItems: AthleteReviewItem[] = reviewRows.map(r => {
    const info = METRIC_INFO[r.metric_key as MetricKey] ?? { label: r.metric_key, unit: '' };
    return {
      sessionId:       r.id,
      metricLabel:     info.label,
      unit:            info.unit,
      value:           Number(r.claimed_value),
      status:          r.status,
      decisionReason:  r.decision_reason ?? null,
      reviewNote:      r.review_note ?? null,
      reviewRequested: Boolean(r.review_requested),
      coachName:       reviewCoachNames[r.coach_clerk_id] ?? 'A coach',
    };
  });

  const tier      = athlete?.subscription_tier ?? 'free';
  const tierLabel =
    tier === 'pro'      ? 'Pro'      :
    tier === 'elite'    ? 'Elite'    :
    tier === 'verified' ? 'Verified' : 'Scout';

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
              label: 'Metrics',
              value: String(allMetrics.length),
              sub: 'Total entries on file',
              highlight: false,
            },
            {
              label: 'Arsenal',
              value: `${arsenalY} / 5`,
              sub: 'Pitches on file',
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

        {/* Verification status — coach-submitted metrics under review or rejected */}
        {verificationItems.length > 0 && (
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
            <AthleteVerificationStatus initialItems={verificationItems} />
          </div>
        )}

        {/* Pitching — Top Pitch Velocity headline card. Parallel to My Metrics:
            athlete_pitches-driven, independent of athlete_metrics presence. */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e2530', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.25rem' }}>
          <TopPitchVelocityCard
            topPitch={topPitch}
            arsenalCount={arsenalY}
            historyMetricKey={topPitchMetricKey}
            historyEntries={topPitchHistory}
          />
        </div>

        <AthleteConnectCard athleteId={user.id} />

        <VerificationDocuments clerkUserId={user.id} />
      </main>
    </div>
  );
}
