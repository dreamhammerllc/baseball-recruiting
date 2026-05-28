import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';
import CoachSidebar from '@/components/layout/CoachSidebar';
import StatCard from '@/components/profile/StatCard';
import VideoPlayer from '@/components/profile/VideoPlayer';
import ExternalProfilePills from '@/components/profile/ExternalProfilePills';
import PublicMetricsSection from '@/app/profile/[username]/PublicMetricsSection';
import CoachActionBar from './CoachActionBar';
import CoachAthleteEvaluation from './CoachAthleteEvaluation';
import PitchArsenal from '@/components/PitchArsenal';
import VerifiedBadge from '@/components/VerifiedBadge';
import type { AthleteMetric, AthletePitch } from '@/lib/metrics';
import type { SubscriptionTier } from '@/lib/subscription';

export const runtime = 'nodejs';

interface AthleteRow {
  id:                       string;
  clerk_user_id:            string;
  first_name:               string | null;
  last_name:                string | null;
  username:                 string | null;
  email:                    string | null;
  parent_email:             string | null;
  phone:                    string | null;
  photo_url:                string | null;
  position:                 string | null;
  secondary_position:       string | null;
  grad_year:                number | null;
  home_state:               string | null;
  height_inches:            number | null;
  weight_lbs:               number | null;
  throws:                   string | null;
  bats:                     string | null;
  gpa_unweighted:           number | null;
  gpa_weighted:             number | null;
  sat_score:                number | null;
  act_score:                number | null;
  exit_velocity_mph:        number | null;
  fastball_velocity_mph:    number | null;
  sixty_yard_dash_seconds:  number | null;
  highlight_video_url:      string | null;
  bio:                      string | null;
  subscription_tier:        SubscriptionTier | null;
  verification_tier:        number | null;
  gamechanger_url:          string | null;
  iscore_url:               string | null;
  perfectgame_url:          string | null;
}

const colors = {
  bg:      '#0d1117',
  surface: '#111827',
  border:  '#1e2530',
  gold:    '#e8a020',
  blue:    '#58a6ff',
  text:    '#f0f6fc',
  muted:   '#6b7280',
};
const mono: React.CSSProperties = { fontFamily: 'monospace' };

function ForbiddenPage({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '4rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: colors.gold, marginBottom: '1rem' }}>◆</div>
          <h1 style={{ color: colors.text, fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
            Access Denied
          </h1>
          <p style={{ color: colors.muted, fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            {message}
          </p>
          <Link
            href="/dashboard/coach/athletes"
            style={{
              ...mono,
              display: 'inline-block',
              background: colors.gold,
              color: '#0a0e14',
              fontWeight: 700,
              fontSize: '0.8rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
            }}
          >
            ← Back to My Athletes
          </Link>
        </div>
      </main>
    </div>
  );
}

export default async function CoachAthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const { userId: coachId } = await auth();

  if (!coachId) {
    return <ForbiddenPage message="You must be signed in as a coach to view athlete profiles." />;
  }

  const db = createAdminClient();

  // 1. Connection check
  const { data: connection } = await db
    .from('coach_athlete_connections')
    .select('id')
    .eq('coach_id',   coachId)
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (!connection) {
    return (
      <ForbiddenPage message="You don't have access to this athlete's profile. Connect with them first by scanning their QR code or entering their invite code." />
    );
  }

  // 2. Fetch athlete row
  const { data: athleteData, error: athErr } = await db
    .from('athletes')
    .select(
      'id, clerk_user_id, first_name, last_name, username, email, parent_email, phone, photo_url, position, secondary_position, grad_year, home_state, height_inches, weight_lbs, throws, bats, gpa_unweighted, gpa_weighted, sat_score, act_score, exit_velocity_mph, fastball_velocity_mph, sixty_yard_dash_seconds, highlight_video_url, bio, subscription_tier, verification_tier, gamechanger_url, iscore_url, perfectgame_url',
    )
    .eq('clerk_user_id', athleteId)
    .maybeSingle();

  if (athErr || !athleteData) {
    return <ForbiddenPage message="This athlete profile could not be loaded." />;
  }

  const athlete = athleteData as AthleteRow;
  const fullName = [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Athlete';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPitcher =
    athlete.position === 'P' ||
    athlete.position === 'TWP' ||
    athlete.secondary_position === 'P' ||
    athlete.secondary_position === 'TWP';

  // 3. Personal-best metrics (separate query, two-query merge pattern)
  const { data: metricsRows } = await db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', athleteId)
    .eq('is_personal_best', true);
  const personalBestMetrics: AthleteMetric[] = (metricsRows ?? []) as AthleteMetric[];

  // 3b. Pitching arsenal (read-only for coach view, ordered by slot)
  const { data: pitchesData } = await db
    .from('athlete_pitches')
    .select('*')
    .eq('athlete_clerk_id', athleteId)
    .order('pitch_slot', { ascending: true });
  const pitches: AthletePitch[] = (pitchesData ?? []) as AthletePitch[];

  // 3c. Pitching velocity history for PitchArsenal History modal — full history,
  //     not just personal-bests. Drives MetricsGraph when a History pill is clicked.
  const { data: pitchMetricsRows } = await db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', athleteId)
    .in('metric_key', ['fastball_velocity', 'slider_velocity', 'curveball_velocity', 'changeup_velocity'])
    .order('recorded_at', { ascending: false });
  const pitchMetricsHistory: AthleteMetric[] = (pitchMetricsRows ?? []) as AthleteMetric[];

  // 4. Saved-state — coach uses internal coaches.id, not clerk_user_id, on saved_athletes.
  let initialSaved = false;
  try {
    const { data: coachRow } = await db
      .from('coaches')
      .select('id')
      .eq('clerk_user_id', coachId)
      .maybeSingle();
    if (coachRow?.id) {
      const { data: savedRow } = await db
        .from('saved_athletes')
        .select('id')
        .eq('coach_id',         coachRow.id)
        .eq('athlete_clerk_id', athleteId)
        .maybeSingle();
      initialSaved = Boolean(savedRow);
    }
  } catch {
    // best-effort — default to not saved
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.bg }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 1.5rem 4rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {/* Back link */}
          <Link
            href="/dashboard/coach/athletes"
            style={{
              ...mono,
              color: colors.muted,
              fontSize: '0.8rem',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: '1.25rem',
            }}
          >
            ← My Athletes
          </Link>

          {/* Hero: photo + name + meta */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Circular gold-bordered photo */}
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: `2px solid ${colors.gold}`,
                background: 'rgba(232,160,32,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {athlete.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={athlete.photo_url}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: colors.gold, fontWeight: 700, fontSize: '1.5rem' }}>{initials}</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 'clamp(1.5rem, 5vw, 2.25rem)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  margin: '0 0 0.5rem',
                  color: colors.text,
                }}
              >
                {fullName}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {athlete.position && <Pill>{athlete.position}</Pill>}
                {athlete.secondary_position && <Pill muted>{athlete.secondary_position}</Pill>}
                {athlete.grad_year && <Pill>{`Class of ${athlete.grad_year}`}</Pill>}
                {athlete.home_state && <Pill>{athlete.home_state}</Pill>}
                <VerifiedBadge variant="full" verificationTier={athlete.verification_tier} />
              </div>
            </div>
          </header>

          {/* Coach action bar */}
          <CoachActionBar
            athleteId={athlete.clerk_user_id}
            athleteName={fullName}
            athletePhoto={athlete.photo_url}
            athleteUsername={athlete.username}
            initialSaved={initialSaved}
          />

          {/* Stats grid */}
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionHeader>Stats</SectionHeader>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {athlete.height_inches != null && (
                <StatCard
                  label="Height"
                  value={`${Math.floor(athlete.height_inches / 12)}'${athlete.height_inches % 12}"`}
                />
              )}
              {athlete.weight_lbs != null && <StatCard label="Weight" value={`${athlete.weight_lbs} lbs`} />}
              {athlete.throws && <StatCard label="Throws" value={athlete.throws === 'R' ? 'RHT' : athlete.throws === 'L' ? 'LHT' : athlete.throws} />}
              {athlete.bats && <StatCard label="Bats" value={athlete.bats === 'R' ? 'RH' : athlete.bats === 'L' ? 'LH' : athlete.bats} />}
              {athlete.gpa_unweighted != null && <StatCard label="GPA (UW)" value={athlete.gpa_unweighted.toFixed(2)} />}
              {athlete.sat_score != null && <StatCard label="SAT" value={String(athlete.sat_score)} />}
              {athlete.act_score != null && <StatCard label="ACT" value={String(athlete.act_score)} />}
              {athlete.exit_velocity_mph != null && <StatCard label="Exit Velo" value={`${athlete.exit_velocity_mph} mph`} />}
              {athlete.sixty_yard_dash_seconds != null && <StatCard label="60 Yd" value={`${athlete.sixty_yard_dash_seconds}s`} />}
              {isPitcher && athlete.fastball_velocity_mph != null && (
                <StatCard label="FB Velo" value={`${athlete.fastball_velocity_mph} mph`} />
              )}
            </div>
          </section>

          {/* Pitching Arsenal — visible to coach when athlete pitches (primary or secondary) */}
          {isPitcher && (
            <section style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>Pitching Arsenal</SectionHeader>
              <PitchArsenal pitches={pitches} readOnly={true} athleteClerkId={athlete.clerk_user_id} pitchHistory={pitchMetricsHistory} showProof={true} />
            </section>
          )}

          {/* Verified Metrics */}
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionHeader gold>Verified Metrics ◆</SectionHeader>
            <PublicMetricsSection
              personalBestMetrics={personalBestMetrics}
              athleteClerkId={athlete.clerk_user_id}
            />
          </section>

          {/* Bio */}
          {athlete.bio && (
            <section style={{ marginBottom: '2.5rem' }}>
              <SectionHeader>Bio</SectionHeader>
              <div
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7, color: colors.text }}>
                  {athlete.bio}
                </p>
              </div>
            </section>
          )}

          {/* Recruiting Video — coaches see a placeholder when empty so they know what's missing. */}
          <VideoPlayer url={athlete.highlight_video_url} title="Recruiting Video" showPlaceholder />

          {/* External Profiles */}
          <ExternalProfilePills
            gamechanger={athlete.gamechanger_url}
            iscore={athlete.iscore_url}
            perfectgame={athlete.perfectgame_url}
          />

          {/* Contact Info — coach-only, never on public profile */}
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionHeader blue>Contact Info (private)</SectionHeader>
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderLeft: `2px solid ${colors.blue}`,
                borderRadius: '0.75rem',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <ContactRow label="Athlete email" value={athlete.email} href={athlete.email ? `mailto:${athlete.email}` : null} />
              <ContactRow label="Parent email"  value={athlete.parent_email} href={athlete.parent_email ? `mailto:${athlete.parent_email}` : null} />
              <ContactRow label="Phone"         value={athlete.phone} href={athlete.phone ? `tel:${athlete.phone.replace(/\D/g, '')}` : null} />
            </div>
            <p style={{ ...mono, color: colors.muted, fontSize: '0.7rem', margin: '0.5rem 0 0', letterSpacing: '0.04em' }}>
              Visible only to connected coaches. Never shown on the athlete&apos;s public profile.
            </p>
          </section>

          {/* Coach's private evaluation — coach-only, never on public profile */}
          <section style={{ marginBottom: '2.5rem' }}>
            <CoachAthleteEvaluation athleteId={athlete.clerk_user_id} />
          </section>

        </div>
      </main>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ children, gold, blue }: { children: React.ReactNode; gold?: boolean; blue?: boolean }) {
  return (
    <h2
      style={{
        ...mono,
        fontSize: '0.65rem',
        letterSpacing: '0.18em',
        color: gold ? colors.gold : blue ? colors.blue : colors.muted,
        textTransform: 'uppercase',
        margin: '0 0 1rem',
      }}
    >
      {children}
    </h2>
  );
}

function Pill({ children, muted, gold }: { children: React.ReactNode; muted?: boolean; gold?: boolean }) {
  return (
    <span
      style={{
        ...mono,
        background: gold ? 'rgba(232,160,32,0.12)' : colors.surface,
        border: `1px solid ${gold ? colors.gold : colors.border}`,
        borderRadius: '0.375rem',
        padding: '0.25rem 0.7rem',
        fontSize: '0.72rem',
        color: gold ? colors.gold : muted ? colors.muted : colors.text,
        fontWeight: gold ? 700 : 500,
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </span>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string | null; href: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
      <span style={{ ...mono, color: colors.muted, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: '110px' }}>
        {label}
      </span>
      {value && href ? (
        <a href={href} style={{ color: colors.blue, fontSize: '0.88rem', textDecoration: 'none' }}>
          {value}
        </a>
      ) : (
        <span style={{ color: colors.muted, fontSize: '0.85rem', fontStyle: 'italic' }}>not provided</span>
      )}
    </div>
  );
}
