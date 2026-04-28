import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import DownloadPDFWrapper from './DownloadPDFWrapper';
import ShareButton from './ShareButton';
import type { DownloadPDFButtonProps } from './DownloadPDFButton';
import PublicMetricsSection from './PublicMetricsSection';
import type { AthleteMetric } from '@/lib/metrics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  grad_year: string | null;
  home_state: string | null;
  gpa_weighted: number | null;
  gpa_unweighted: number | null;
  sat_score: number | null;
  act_score: number | null;
  exit_velocity_mph: number | null;
  fastball_velocity_mph: number | null;
  sixty_yard_dash: number | null;
  division_pref: string | null;
  bio: string | null;
  transcript_url: string | null;
  test_scores_url: string | null;
  subscription_tier: string | null;
}

interface SchoolMatch {
  school_name: string;
  fit_score: number;
  athletic_fit: number | null;
  reason: string | null;
  division: string | null;
}

// ─── FitRing SVG ──────────────────────────────────────────────────────────────

function FitRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const fill = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - fill);
  const color = score >= 80 ? '#e8a020' : score >= 60 ? '#58a6ff' : '#6b7280';

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#1e2530" strokeWidth="4" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="33" textAnchor="middle" fill={color} fontSize="11" fontFamily="monospace" fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const db = createAdminClient();

  // 1. Fetch athlete row
  const { data: athlete, error: athleteError } = await db
    .from('athletes')
    .select(
      'id, first_name, last_name, position, grad_year, home_state, gpa_weighted, gpa_unweighted, sat_score, act_score, exit_velocity_mph, fastball_velocity_mph, sixty_yard_dash, division_pref, bio, transcript_url, test_scores_url, subscription_tier',
    )
    .eq('clerk_user_id', username)
    .maybeSingle();

  if (athleteError || !athlete) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0d1117',
          color: '#f0f6fc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          gap: '1.5rem',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            color: '#e8a020',
          }}
        >
          &#9670; DIAMOND VERIFIED
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Profile Not Found</h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          This athlete profile does not exist or has been removed.
        </p>
        <Link
          href="/"
          style={{
            color: '#58a6ff',
            textDecoration: 'none',
            fontSize: '0.875rem',
            border: '1px solid #1e2530',
            padding: '0.5rem 1.25rem',
            borderRadius: '0.5rem',
          }}
        >
          &larr; Back to Home
        </Link>
      </main>
    );
  }

  const athleteData = athlete as AthleteRow;

  // 2. Fetch is_verified (isolated)
  let isVerified = false;
  try {
    const { data: verRow } = await db
      .from('athletes')
      .select('is_verified')
      .eq('clerk_user_id', username)
      .maybeSingle();
    if (verRow && typeof (verRow as Record<string, unknown>).is_verified === 'boolean') {
      isVerified = (verRow as { is_verified: boolean }).is_verified;
    }
  } catch {
    // column may not exist yet — ignore
  }

  // 3. Fetch top 3 school matches
  let schoolMatches: SchoolMatch[] = [];
  try {
    const { data: matchRows } = await db
      .from('school_matches')
      .select('school_name, fit_score, athletic_fit, reason, division')
      .eq('athlete_id', athleteData.id)
      .order('fit_score', { ascending: false })
      .limit(3);
    if (matchRows) {
      schoolMatches = matchRows as SchoolMatch[];
    }
  } catch {
    // table may not exist yet — ignore
  }

  // 4. Fetch personal-best metrics
  let personalBestMetrics: AthleteMetric[] = [];
  try {
    const { data: metricsRows } = await db
      .from('athlete_metrics')
      .select('*')
      .eq('athlete_clerk_id', username)
      .eq('is_personal_best', true);
    if (metricsRows) {
      personalBestMetrics = metricsRows as AthleteMetric[];
    }
  } catch {
    // table may not exist yet — ignore
  }

  // 5. Fetch athlete positions (resilient)
  // (used for display context — not currently shown but fetched for future use)
  let athletePositions: { primary_position: string; secondary_position: string | null } | null =
    null;
  try {
    const { data: posRow } = await db
      .from('athlete_positions')
      .select('primary_position, secondary_position')
      .eq('athlete_clerk_id', username)
      .maybeSingle();
    if (posRow) {
      athletePositions = posRow as { primary_position: string; secondary_position: string | null };
    }
  } catch {
    // table may not exist yet — ignore
  }
  void athletePositions; // referenced above; suppress unused warning

  // ─── Derived values ──────────────────────────────────────────────────────────

  const fullName =
    [athleteData.first_name, athleteData.last_name].filter(Boolean).join(' ') || 'Athlete';

  const gpa = athleteData.gpa_weighted ?? athleteData.gpa_unweighted;
  const gpaLabel = athleteData.gpa_weighted != null ? 'GPA (W)' : 'GPA (UW)';

  const isPitcher =
    athleteData.position?.toUpperCase() === 'P' ||
    athleteData.position?.toUpperCase() === 'TWP';

  const tier = athleteData.subscription_tier ?? 'athlete_free';
  const tierLabel =
    tier === 'athlete_pro'
      ? 'Athlete Pro'
      : tier === 'athlete'
        ? 'Athlete'
        : 'Free Profile';

  const pdfProps: DownloadPDFButtonProps = {
    athleteName: fullName,
    position: athleteData.position,
    gradYear: athleteData.grad_year,
    homeState: athleteData.home_state,
    gpa,
    sat: athleteData.sat_score,
    exitVelocity: athleteData.exit_velocity_mph,
    dashTime: athleteData.sixty_yard_dash,
    fastballVelo: athleteData.fastball_velocity_mph,
    schoolMatches: schoolMatches.map((m) => ({
      school_name: m.school_name,
      fit_score: m.fit_score,
      athletic_fit: m.athletic_fit,
      reason: m.reason,
      division: m.division,
    })),
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const colors = {
    bg: '#0d1117',
    surface: '#111827',
    border: '#1e2530',
    gold: '#e8a020',
    blue: '#58a6ff',
    text: '#f0f6fc',
    muted: '#6b7280',
  };

  const mono: React.CSSProperties = { fontFamily: 'monospace' };
  const serif: React.CSSProperties = { fontFamily: 'Georgia, serif' };

  return (
    <main style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          borderBottom: `1px solid ${colors.border}`,
          padding: '0.875rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(13,17,23,0.97)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: colors.gold, fontSize: '1.1rem' }}>&#9670;</span>
          <span
            style={{
              ...mono,
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: colors.gold,
            }}
          >
            DIAMOND VERIFIED
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            href="/sign-in"
            style={{
              ...mono,
              color: colors.muted,
              textDecoration: 'none',
              fontSize: '0.8rem',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            style={{
              ...mono,
              background: colors.gold,
              color: '#0d1117',
              padding: '0.45rem 1rem',
              borderRadius: '0.375rem',
              textDecoration: 'none',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            Create Free Profile
          </Link>
        </div>
      </nav>

      {/* ── CONTENT WRAPPER ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

        {/* ── HERO / PROFILE HEADER ──────────────────────────────────────────── */}
        <section style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              ...serif,
              fontSize: 'clamp(2rem, 6vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              margin: '0 0 1rem',
              letterSpacing: '-0.02em',
            }}
          >
            {fullName}
          </h1>

          {/* Badges row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            {athleteData.position && (
              <span
                style={{
                  ...mono,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: colors.text,
                  letterSpacing: '0.05em',
                }}
              >
                {athleteData.position}
              </span>
            )}
            {athleteData.grad_year && (
              <span
                style={{
                  ...mono,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: colors.text,
                  letterSpacing: '0.05em',
                }}
              >
                {athleteData.grad_year}
              </span>
            )}
            {athleteData.home_state && (
              <span
                style={{
                  ...mono,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: colors.text,
                  letterSpacing: '0.05em',
                }}
              >
                {athleteData.home_state}
              </span>
            )}
            {isVerified && (
              <span
                style={{
                  ...mono,
                  background: 'rgba(232,160,32,0.12)',
                  border: `1px solid ${colors.gold}`,
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: colors.gold,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                &#9670; Diamond Verified
              </span>
            )}
          </div>

          {/* Subscription tier label */}
          <p
            style={{
              ...mono,
              fontSize: '0.7rem',
              color: colors.muted,
              marginTop: '0.75rem',
              letterSpacing: '0.08em',
            }}
          >
            {tierLabel}
          </p>
        </section>

        {/* ── ACTION BUTTONS ROW ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: tier === 'athlete_pro' ? '1fr 1fr' : '1fr',
            gap: '0.75rem',
            marginBottom: '2.5rem',
            maxWidth: '480px',
          }}
        >
          <ShareButton />
          {tier === 'athlete_pro' && <DownloadPDFWrapper {...pdfProps} />}
        </div>

        {/* ── STATS GRID ─────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2
            style={{
              ...mono,
              fontSize: '0.65rem',
              letterSpacing: '0.18em',
              color: colors.muted,
              textTransform: 'uppercase',
              margin: '0 0 1rem',
            }}
          >
            Stats
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {gpa != null && (
              <StatCard label={gpaLabel} value={String(gpa.toFixed(2))} colors={colors} />
            )}
            {athleteData.sat_score != null && (
              <StatCard label="SAT" value={String(athleteData.sat_score)} colors={colors} />
            )}
            {athleteData.act_score != null && (
              <StatCard label="ACT" value={String(athleteData.act_score)} colors={colors} />
            )}
            {athleteData.exit_velocity_mph != null && (
              <StatCard
                label="Exit Velo"
                value={`${athleteData.exit_velocity_mph} mph`}
                colors={colors}
              />
            )}
            {athleteData.sixty_yard_dash != null && (
              <StatCard
                label="60 Yd"
                value={`${athleteData.sixty_yard_dash}s`}
                colors={colors}
              />
            )}
            {isPitcher && athleteData.fastball_velocity_mph != null && (
              <StatCard
                label="FB Velo"
                value={`${athleteData.fastball_velocity_mph} mph`}
                colors={colors}
              />
            )}
            {athleteData.division_pref && (
              <StatCard label="Division Pref" value={athleteData.division_pref} colors={colors} />
            )}
          </div>
        </section>

        {/* ── VERIFIED METRICS SECTION ───────────────────────────────────────── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                ...mono,
                fontSize: '0.65rem',
                letterSpacing: '0.18em',
                color: colors.muted,
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Verified Metrics
            </h2>
            <span style={{ color: colors.gold, fontSize: '0.75rem' }}>&#9670;</span>
          </div>
          <PublicMetricsSection
            personalBestMetrics={personalBestMetrics}
            athleteClerkId={username}
          />
        </section>

        {/* ── SCHOOL MATCHES ─────────────────────────────────────────────────── */}
        {schoolMatches.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2
              style={{
                ...mono,
                fontSize: '0.65rem',
                letterSpacing: '0.18em',
                color: colors.muted,
                textTransform: 'uppercase',
                margin: '0 0 1rem',
              }}
            >
              Top School Matches
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {schoolMatches.map((match, idx) => (
                <div
                  key={idx}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <FitRing score={match.fit_score} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 0.25rem',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {match.school_name}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {match.division && (
                        <span
                          style={{
                            ...mono,
                            fontSize: '0.7rem',
                            color: colors.muted,
                            background: '#0d1117',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '0.25rem',
                            padding: '0.1rem 0.45rem',
                          }}
                        >
                          {match.division}
                        </span>
                      )}
                      {match.athletic_fit != null && (
                        <span
                          style={{
                            ...mono,
                            fontSize: '0.7rem',
                            color: colors.muted,
                          }}
                        >
                          Athletic Fit: {match.athletic_fit}
                        </span>
                      )}
                    </div>
                    {match.reason && (
                      <p
                        style={{
                          ...mono,
                          margin: '0.4rem 0 0',
                          fontSize: '0.75rem',
                          color: colors.muted,
                          lineHeight: 1.5,
                        }}
                      >
                        {match.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── BIO ────────────────────────────────────────────────────────────── */}
        {athleteData.bio && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2
              style={{
                ...mono,
                fontSize: '0.65rem',
                letterSpacing: '0.18em',
                color: colors.muted,
                textTransform: 'uppercase',
                margin: '0 0 1rem',
              }}
            >
              Bio
            </h2>
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  color: colors.text,
                }}
              >
                {athleteData.bio}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${colors.border}`,
          padding: '1.5rem 2rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            ...mono,
            fontSize: '0.7rem',
            color: colors.muted,
            margin: 0,
            letterSpacing: '0.08em',
          }}
        >
          &#9670; DIAMOND VERIFIED | Baseball Recruiting Platform
        </p>
      </footer>
    </main>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: {
    surface: string;
    border: string;
    muted: string;
    text: string;
  };
}) {
  return (
    <div
      style={{
        background: '#111827',
        border: `1px solid ${colors.border}`,
        borderRadius: '0.75rem',
        padding: '0.875rem 1rem',
      }}
    >
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: '0.65rem',
          color: colors.muted,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: '0 0 0.35rem',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: colors.text,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
