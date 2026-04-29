'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';

// ── Shared tokens ─────────────────────────────────────────────────────────────
const BG        = '#0d1117';
const BG2       = '#111827';
const BG3       = '#0a0e14';
const BORDER    = '#1e2530';
const GOLD      = '#e8a020';
const BLUE      = '#58a6ff';
const TEXT      = '#f0f6fc';
const MUTED     = '#8b949e';
const SUBTLE    = '#30363d';
const SERIF     = 'Georgia, "Times New Roman", serif';
const MONO      = '"Courier New", Courier, monospace';

// ── Reusable primitives ───────────────────────────────────────────────────────

function GoldBtn({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} style={{
      display: 'inline-block',
      padding: '0.75rem 1.75rem',
      background: hov ? '#c98a18' : GOLD,
      color: '#000',
      fontFamily: MONO,
      fontWeight: 700,
      fontSize: '0.85rem',
      letterSpacing: '0.06em',
      textDecoration: 'none',
      borderRadius: '4px',
      transition: 'background 0.15s',
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </Link>
  );
}

function BlueBtn({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} style={{
      display: 'inline-block',
      padding: '0.75rem 1.75rem',
      background: hov ? '#3b82f6' : BLUE,
      color: '#000',
      fontFamily: MONO,
      fontWeight: 700,
      fontSize: '0.85rem',
      letterSpacing: '0.06em',
      textDecoration: 'none',
      borderRadius: '4px',
      transition: 'background 0.15s',
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </Link>
  );
}

function OutlineBtn({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} style={{
      display: 'inline-block',
      padding: '0.7rem 1.5rem',
      background: 'transparent',
      color: hov ? TEXT : MUTED,
      border: `1px solid ${hov ? SUBTLE : BORDER}`,
      fontFamily: MONO,
      fontWeight: 600,
      fontSize: '0.82rem',
      letterSpacing: '0.05em',
      textDecoration: 'none',
      borderRadius: '4px',
      transition: 'color 0.15s, border-color 0.15s',
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </Link>
  );
}

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

function Divider() {
  return <div style={{ height: '1px', background: BORDER, margin: '0 auto', maxWidth: '1100px' }} />;
}

function Bullet({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginBottom: '0.6rem', listStyle: 'none' }}>
      <span style={{ color, flexShrink: 0, marginTop: '0.1rem', fontFamily: MONO }}>&#9670;</span>
      <span style={{ color: MUTED, fontSize: '0.92rem', lineHeight: 1.55 }}>{children}</span>
    </li>
  );
}

function Step({ n, title, body, color }: { n: number; title: string; body: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0,
        width: '40px', height: '40px',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontWeight: 700, fontSize: '0.85rem', color,
      }}>
        {n}
      </div>
      <div>
        <p style={{ margin: '0 0 0.3rem', fontFamily: SERIF, fontWeight: 700, fontSize: '1rem', color: TEXT }}>{title}</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: MUTED, lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {

  const { isSignedIn } = useAuth();
  const [hovAthleteCard, setHovAthleteCard] = useState(false);
  const [hovCoachCard,   setHovCoachCard]   = useState(false);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: SERIF, overflowX: 'hidden' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isSignedIn ? (
            <GoldBtn href="/dashboard">Go to Dashboard</GoldBtn>
          ) : (
            <>
              <OutlineBtn href="/sign-in">Sign In</OutlineBtn>
              <GoldBtn href="/sign-up">Create Free Profile</GoldBtn>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: 'clamp(4rem, 8vw, 7rem) 1.5rem clamp(3rem, 6vw, 5rem)',
        textAlign: 'center',
      }}>
        <Label color={GOLD}>The recruiting platform built on verified truth</Label>

        <h1 style={{
          fontFamily: SERIF,
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 700,
          color: TEXT,
          margin: '0 0 1.25rem',
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          maxWidth: '780px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          The verified bridge between athletes and coaches
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.15rem)',
          color: MUTED,
          maxWidth: '560px',
          margin: '0 auto 3.5rem',
          lineHeight: 1.7,
        }}>
          Diamond Verified records athlete metrics on video, runs AI legitimacy checks,
          and surfaces the results to college programs that are actively recruiting.
        </p>

        {/* Two hero cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          textAlign: 'left',
        }}>

          {/* Athlete card */}
          <div
            onMouseEnter={() => setHovAthleteCard(true)}
            onMouseLeave={() => setHovAthleteCard(false)}
            style={{
              background: BG2,
              border: `1px solid ${hovAthleteCard ? GOLD : 'rgba(232,160,32,0.3)'}`,
              borderRadius: '10px',
              padding: '2rem',
              transition: 'border-color 0.2s',
            }}
          >
            <Label color={GOLD}>For Athletes</Label>
            <h3 style={{ fontFamily: SERIF, fontSize: '1.35rem', color: TEXT, margin: '0 0 1.25rem', fontWeight: 700 }}>
              Get verified. Get seen.
            </h3>
            <ul style={{ margin: '0 0 1.75rem', padding: 0 }}>
              <Bullet color={GOLD}>Build a free profile with stats, GPA, and video</Bullet>
              <Bullet color={GOLD}>Book a testing session with a Diamond Verified coach</Bullet>
              <Bullet color={GOLD}>Earn a Coach Verified badge after AI review</Bullet>
              <Bullet color={GOLD}>Appear in college coach prospect searches</Bullet>
            </ul>
            <GoldBtn href="/sign-up">Create Athlete Profile &rarr;</GoldBtn>
          </div>

          {/* Coach card */}
          <div
            onMouseEnter={() => setHovCoachCard(true)}
            onMouseLeave={() => setHovCoachCard(false)}
            style={{
              background: BG2,
              border: `1px solid ${hovCoachCard ? BLUE : 'rgba(88,166,255,0.3)'}`,
              borderRadius: '10px',
              padding: '2rem',
              transition: 'border-color 0.2s',
            }}
          >
            <Label color={BLUE}>For Coaches</Label>
            <h3 style={{ fontFamily: SERIF, fontSize: '1.35rem', color: TEXT, margin: '0 0 1.25rem', fontWeight: 700 }}>
              Find recruits you can trust.
            </h3>
            <ul style={{ margin: '0 0 1.75rem', padding: 0 }}>
              <Bullet color={BLUE}>Search verified athletes by position, stats, and GPA</Bullet>
              <Bullet color={BLUE}>View AI-generated scout assessments for each prospect</Bullet>
              <Bullet color={BLUE}>Run testing sessions and record metrics on video</Bullet>
              <Bullet color={BLUE}>10 free test slots per month to get started</Bullet>
            </ul>
            <BlueBtn href="/sign-up">Create Coach Account &rarr;</BlueBtn>
          </div>

        </div>
      </section>

      <Divider />

      {/* ── VERIFICATION TIERS ───────────────────────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <Label>Verification tiers</Label>
          <SectionHeading>Not all stats are created equal</SectionHeading>
          <p style={{ color: MUTED, fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
            Diamond Verified makes the source of every metric transparent so coaches
            know exactly how much to trust what they see.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>

          {/* Coach Verified */}
          <div style={{ background: BG2, border: `1px solid rgba(232,160,32,0.4)`, borderRadius: '10px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ color: GOLD, fontSize: '1.2rem' }}>&#9670;</span>
              <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD }}>
                COACH VERIFIED
              </span>
            </div>
            <p style={{ color: TEXT, fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.6rem' }}>
              Recorded in person
            </p>
            <p style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>
              A Diamond Verified coach captured each test on video in 90-second increments.
              AI reviewed the footage for legitimacy before the badge was issued.
              Highest trust level available on the platform.
            </p>
          </div>

          {/* 3rd Party Verified */}
          <div style={{ background: BG2, border: `1px solid rgba(88,166,255,0.4)`, borderRadius: '10px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ color: BLUE, fontSize: '1.2rem' }}>&#10003;</span>
              <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: BLUE }}>
                3RD PARTY VERIFIED
              </span>
            </div>
            <p style={{ color: TEXT, fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.6rem' }}>
              Linked external platform
            </p>
            <p style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>
              The athlete linked a verified external source such as HitTrax, Rapsodo, or
              Perfect Game. Displayed with the source label so coaches know where the
              data originated.
            </p>
          </div>

          {/* Self Reported */}
          <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ color: MUTED, fontSize: '1.2rem' }}>&#8212;</span>
              <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: MUTED }}>
                SELF REPORTED
              </span>
            </div>
            <p style={{ color: TEXT, fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.6rem' }}>
              Athlete entered manually
            </p>
            <p style={{ color: MUTED, fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>
              Stats entered directly by the athlete without external verification.
              Still visible to coaches but clearly labeled as self-reported.
              Upgrade to get verified.
            </p>
          </div>

        </div>
      </section>

      <Divider />

      {/* ── HOW IT WORKS: ATHLETES ───────────────────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'start' }}>

          <div>
            <Label color={GOLD}>How it works</Label>
            <SectionHeading>For athletes</SectionHeading>
            <p style={{ color: MUTED, fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 2rem' }}>
              From free profile to Coach Verified badge in four steps.
              No gatekeepers. No waiting for coaches to find you.
            </p>
            <GoldBtn href="/sign-up">Get Started Free &rarr;</GoldBtn>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Step n={1} color={GOLD}
              title="Create a free profile"
              body="Add your position, grad year, GPA, and key stats. Your public profile page is live immediately."
            />
            <Step n={2} color={GOLD}
              title="Book a testing session"
              body="Find a Diamond Verified coach near you and book a session. Coaches set their own prices and availability."
            />
            <Step n={3} color={GOLD}
              title="Get tested on video"
              body="Your coach records each test in 90-second increments. AI reviews the footage within 72 hours."
            />
            <Step n={4} color={GOLD}
              title="Earn your Coach Verified badge"
              body="Verified metrics populate your profile automatically. College coaches searching the platform can now find you."
            />
          </div>

        </div>
      </section>

      <Divider />

      {/* ── HOW IT WORKS: COACHES ────────────────────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Step n={1} color={BLUE}
              title="Register as a Diamond Verified coach"
              body="Create your coach profile, set your prices, and publish your scheduling link. Free to join."
            />
            <Step n={2} color={BLUE}
              title="Appear in the Coach Finder"
              body="Athletes searching for testing near them will see your profile. Free coaches get 10 test slots per month."
            />
            <Step n={3} color={BLUE}
              title="Run sessions and record metrics"
              body="Use the coach dashboard to record each test in 90-second video increments. The platform handles the rest."
            />
            <Step n={4} color={BLUE}
              title="Browse and save verified prospects"
              body="College coaches on the platform can search all verified athletes by position, stats, GPA, and location."
            />
          </div>

          <div>
            <Label color={BLUE}>How it works</Label>
            <SectionHeading>For coaches</SectionHeading>
            <p style={{ color: MUTED, fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 2rem' }}>
              Run a legitimate testing business and help athletes get real opportunities.
              Start with 10 free sessions per month.
            </p>
            <BlueBtn href="/sign-up">Create Coach Account &rarr;</BlueBtn>
          </div>

        </div>
      </section>

      <Divider />

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <Label>Pricing</Label>
          <SectionHeading>Free to start for everyone</SectionHeading>
          <p style={{ color: MUTED, fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.7 }}>
            Athletes and coaches both get a powerful free tier.
            Upgrade when you are ready to go further.
          </p>
        </div>

        {/* Athlete plans */}
        <p style={{ fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: GOLD, marginBottom: '1rem' }}>
          ATHLETE PLANS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>

          {/* Athlete Free */}
          <PricingCard
            title="Athlete Free"
            price="$0"
            period="forever"
            accent={GOLD}
            highlight={false}
            features={[
              'Public profile page',
              'Self-reported stats',
              'School match calculator',
              'Share profile with coaches',
            ]}
          />

          {/* Athlete */}
          <PricingCard
            title="Athlete"
            price="$29.99"
            period="per month"
            accent={GOLD}
            highlight={true}
            badge="Most Popular"
            features={[
              'Everything in Free',
              'Upload transcript and test scores',
              'AI scout assessment on profile',
              'AI development roadmap',
              'Appear in college coach searches',
            ]}
          />

          {/* Athlete Pro */}
          <PricingCard
            title="Athlete Pro"
            price="$59.99"
            period="per month"
            accent={GOLD}
            highlight={false}
            features={[
              'Everything in Athlete',
              'Priority in coach search results',
              'Email when a coach views profile',
              'Advanced school matching filters',
              'Direct message with coaches',
            ]}
          />

        </div>

        {/* Coach plans */}
        <p style={{ fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: BLUE, marginBottom: '1rem' }}>
          COACH PLANS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* Coach Free */}
          <PricingCard
            title="Coach Free"
            price="$0"
            period="forever"
            accent={BLUE}
            highlight={false}
            features={[
              'Listed in Coach Finder',
              '10 test slots per month',
              'Set your own session prices',
              'Video recording via dashboard',
              'Basic prospect search',
            ]}
          />

          {/* Coach Dashboard */}
          <PricingCard
            title="Coach Dashboard"
            price="$149.99"
            period="per month"
            accent={BLUE}
            highlight={false}
            badge="Unlimited"
            features={[
              'Everything in Coach Free',
              'Unlimited test slots per month',
              'Daily retesting per athlete',
              'Advanced prospect search filters',
              'Save and track prospect lists',
              'Priority placement in Coach Finder',
            ]}
          />

        </div>
      </section>

      <Divider />

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1100px', margin: '0 auto',
        padding: 'clamp(3rem, 6vw, 5rem) 1.5rem',
        textAlign: 'center',
      }}>
        <Label>Get started today</Label>
        <SectionHeading>Verified metrics change recruiting outcomes</SectionHeading>
        <p style={{ color: MUTED, fontSize: '1rem', maxWidth: '500px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Join athletes who are getting seen by college programs and coaches who are
          building a legitimate testing business. Both start free.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <GoldBtn href="/sign-up">Create Athlete Profile &rarr;</GoldBtn>
          <BlueBtn href="/sign-up">Create Coach Account &rarr;</BlueBtn>
        </div>
      </section>

      <Divider />

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
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
          &copy; 2026 Diamond Verified &nbsp;&middot;&nbsp; baseballrecruit.com
        </p>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/sign-in"  style={{ fontFamily: MONO, fontSize: '0.78rem', color: MUTED, textDecoration: 'none' }}>Sign In</Link>
          <Link href="/sign-up"  style={{ fontFamily: MONO, fontSize: '0.78rem', color: MUTED, textDecoration: 'none' }}>Sign Up</Link>
        </div>
      </footer>

    </div>
  );
}

// ── Pricing card ──────────────────────────────────────────────────────────────

function PricingCard({
  title, price, period, accent, highlight, badge, features,
}: {
  title: string;
  price: string;
  period: string;
  accent: string;
  highlight: boolean;
  badge?: string;
  features: string[];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: highlight ? `rgba(${accent === GOLD ? '232,160,32' : '88,166,255'},0.06)` : BG2,
        border: `1px solid ${hov || highlight ? accent : BORDER}`,
        borderRadius: '10px',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        position: 'relative',
        transition: 'border-color 0.2s',
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute', top: '-1px', right: '1.25rem',
          background: accent, color: '#000',
          fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700,
          letterSpacing: '0.08em', padding: '0.2rem 0.6rem',
          borderRadius: '0 0 4px 4px',
        }}>
          {badge}
        </div>
      )}
      <p style={{ fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: accent, margin: '0 0 0.75rem', textTransform: 'uppercase' }}>
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.3rem' }}>
        <span style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, color: TEXT }}>{price}</span>
      </div>
      <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: MUTED, margin: '0 0 1.5rem' }}>{period}</p>
      <ul style={{ margin: '0 0 1.75rem', padding: 0, flexGrow: 1 }}>
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.55rem', listStyle: 'none' }}>
            <span style={{ color: accent, fontFamily: MONO, flexShrink: 0, fontSize: '0.75rem', marginTop: '0.2rem' }}>&#10003;</span>
            <span style={{ color: MUTED, fontSize: '0.85rem', lineHeight: 1.5 }}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href="/sign-up" style={{
        display: 'block',
        textAlign: 'center',
        padding: '0.65rem',
        background: highlight ? accent : 'transparent',
        color: highlight ? '#000' : accent,
        border: `1px solid ${accent}`,
        fontFamily: MONO, fontWeight: 700, fontSize: '0.8rem',
        letterSpacing: '0.05em',
        textDecoration: 'none',
        borderRadius: '4px',
        transition: 'background 0.15s, color 0.15s',
      }}>
        Get Started
      </Link>
    </div>
  );
}
