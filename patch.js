const fs = require('fs');
const path = require('path');

const content = `'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontFamily: "'Georgia', serif" }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #21262d', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,17,23,0.97)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⬡</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.05em', color: '#e8a020' }}>DIAMOND VERIFIED</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/sign-in" style={{ color: '#8b949e', textDecoration: 'none', fontSize: '0.875rem', fontFamily: 'monospace' }}>Sign In</Link>
          <Link href="/sign-up" style={{ background: '#e8a020', color: '#0d1117', padding: '0.5rem 1.25rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>CREATE FREE PROFILE</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '6rem 2rem 5rem', textAlign: 'center', maxWidth: '860px', margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(232,160,32,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-block', background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)', borderRadius: '100px', padding: '0.375rem 1rem', fontSize: '0.75rem', letterSpacing: '0.15em', color: '#e8a020', fontFamily: 'monospace', marginBottom: '2rem' }}>
          ◆ BASEBALL RECRUITING PLATFORM
        </div>
        <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 4.75rem)', fontWeight: 800, lineHeight: 1.05, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
          The verified bridge between<br />
          <span style={{ color: '#e8a020' }}>athletes and coaches.</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#8b949e', maxWidth: '640px', margin: '0 auto 1.5rem', lineHeight: 1.7, fontFamily: 'monospace' }}>
          Diamond Verified is a baseball recruiting platform where athletes earn verified metric profiles through certified coaches — and coaches build a reputation that attracts serious talent.
        </p>
        <p style={{ fontSize: '0.9rem', color: '#8b949e', fontFamily: 'monospace', marginBottom: '3rem' }}>
          Both athletes and coaches start <span style={{ color: '#e8a020' }}>completely free.</span>
        </p>

        {/* TWO PATH CTAs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '680px', margin: '0 auto' }}>
          
          {/* ATHLETE PATH */}
          <div style={{ background: '#161b22', border: '1px solid #e8a020', borderRadius: '8px', padding: '2rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#e8a020', fontFamily: 'monospace', marginBottom: '0.75rem' }}>◆ FOR ATHLETES</div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>Get discovered by college coaches</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Free verified athlete profile', 'Get coach-verified metrics', 'Find verified coaches near you', 'Upgrade for AI assessment & more'].map(f => (
                <li key={f} style={{ fontSize: '0.8rem', color: '#8b949e', fontFamily: 'monospace', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#e8a020' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" style={{ display: 'block', textAlign: 'center', background: '#e8a020', color: '#0d1117', padding: '0.75rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              CREATE ATHLETE PROFILE →
            </Link>
          </div>

          {/* COACH PATH */}
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '2rem', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#21262d')}
          >
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#58a6ff', fontFamily: 'monospace', marginBottom: '0.75rem' }}>◆ FOR COACHES</div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>Verify athletes. Grow your business.</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Free verified coach profile', 'Test up to 10 athletes/month free', 'Athletes find & book you directly', 'Set your own testing prices'].map(f => (
                <li key={f} style={{ fontSize: '0.8rem', color: '#8b949e', fontFamily: 'monospace', display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#58a6ff' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" style={{ display: 'block', textAlign: 'center', background: 'transparent', border: '1px solid #58a6ff', color: '#58a6ff', padding: '0.75rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              CREATE COACH PROFILE →
            </Link>
          </div>

        </div>
      </section>

      {/* DIVIDER */}
      <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #21262d 30%, #21262d 70%, transparent)', margin: '1rem 0' }} />

      {/* HOW VERIFICATION WORKS */}
      <section style={{ padding: '5rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#e8a020', fontFamily: 'monospace', marginBottom: '1rem' }}>◆ HOW VERIFICATION WORKS</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>Not all metrics are created equal.</h2>
          <p style={{ color: '#8b949e', fontFamily: 'monospace', fontSize: '0.875rem', marginTop: '1rem', lineHeight: 1.7, maxWidth: '600px', margin: '1rem auto 0' }}>
            Diamond Verified uses a tiered verification system so coaches recruiting off your profile know exactly how your numbers were recorded.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { badge: '◆ Coach Verified', color: '#e8a020', title: 'Highest Trust', desc: 'Metric was recorded in person by a Diamond Verified coach using our platform. Video is AI-reviewed and attached to the result.' },
            { badge: '✓ 3rd Party Verified', color: '#58a6ff', title: 'External Source', desc: 'Athlete linked a verified showcase or platform (HitTrax, Rapsodo, Perfect Game, etc.). Source is clearly labeled on the profile.' },
            { badge: '○ Self Reported', color: '#8b949e', title: 'Unverified', desc: 'Athlete entered the number themselves with no supporting documentation. Displayed but clearly marked as unverified.' },
          ].map(v => (
            <div key={v.badge} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '1.75rem' }}>
              <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.04)', border: \`1px solid \${v.color}44\`, borderRadius: '4px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: v.color, fontFamily: 'monospace', marginBottom: '1rem' }}>{v.badge}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{v.title}</h3>
              <p style={{ fontSize: '0.8rem', color: '#8b949e', lineHeight: 1.6, fontFamily: 'monospace' }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — ATHLETE */}
      <section style={{ padding: '5rem 2rem', background: '#0d1117', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#e8a020', fontFamily: 'monospace', marginBottom: '1rem' }}>◆ FOR ATHLETES</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>From profile to recruited.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { n: '01', t: 'Create Your Free Profile', d: 'Enter your position, stats, GPA, and grad year. Your profile is immediately searchable by verified college coaches.' },
            { n: '02', t: 'Find a Verified Coach Near You', d: 'Browse verified coaches in your area. See their testing services, prices, and book directly through their scheduling link.' },
            { n: '03', t: 'Get Your Metrics Coach Verified', d: 'Show up, get tested. The coach records each metric in 90-second video increments. AI reviews the footage within 72 hours.' },
            { n: '04', t: 'Your Profile Updates Automatically', d: 'Verified metrics populate your profile with the ◆ Coach Verified badge. College coaches see real, trusted numbers.' },
          ].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', gap: '2rem', padding: '2rem 0', borderBottom: i < 3 ? '1px solid #21262d' : 'none', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'rgba(232,160,32,0.25)', fontFamily: 'monospace', minWidth: '60px', lineHeight: 1 }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>{s.t}</h3>
                <p style={{ fontSize: '0.85rem', color: '#8b949e', lineHeight: 1.6, fontFamily: 'monospace' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — COACH */}
      <section style={{ padding: '5rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#58a6ff', fontFamily: 'monospace', marginBottom: '1rem' }}>◆ FOR COACHES</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>Build your reputation. Earn more.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { n: '01', t: 'Create Your Free Coach Profile', d: 'Set up your verified coach profile. List your credentials, your testing services, your prices, and connect your scheduling link.' },
            { n: '02', t: 'Athletes Find and Book You', d: 'Athletes in your area discover your profile through the Coach Finder. They see your services and book directly through your calendar.' },
            { n: '03', t: 'Record and Submit Metrics', d: 'At the session, link the athlete in your dashboard and record each test in 90-second video increments. Submit when complete.' },
            { n: '04', t: 'AI Reviews. Profile Updates.', d: 'Our AI reviews each video for legitimacy. Valid results populate the athlete\'s profile with your name attached as the verifying coach.' },
          ].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', gap: '2rem', padding: '2rem 0', borderBottom: i < 3 ? '1px solid #21262d' : 'none', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'rgba(88,166,255,0.2)', fontFamily: 'monospace', minWidth: '60px', lineHeight: 1 }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>{s.t}</h3>
                <p style={{ fontSize: '0.85rem', color: '#8b949e', lineHeight: 1.6, fontFamily: 'monospace' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '5rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#e8a020', fontFamily: 'monospace', marginBottom: '1rem' }}>◆ PRICING</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>Start free. Upgrade when you're ready.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
          {[
            { name: 'ATHLETE FREE', price: '$0', period: 'forever', color: '#8b949e', highlight: false, audience: 'Athletes',
              features: ['Basic athlete profile', 'Receive coach-verified metrics', 'Find coaches near you', 'Public shareable profile link'] },
            { name: 'ATHLETE', price: '$29.99', period: '/mo', color: '#e8a020', highlight: true, audience: 'Athletes',
              features: ['Everything in Free', '◆ Diamond Verified badge', 'AI Scout Assessment', 'Daily training video uploads', '3rd party platform linking'] },
            { name: 'ATHLETE PRO', price: '$59.99', period: '/mo', color: '#e8a020', highlight: false, audience: 'Athletes',
              features: ['Everything in Athlete', 'AI Development Roadmap', 'PDF profile export', 'Email profile to coaches', 'Priority in coach search'] },
            { name: 'COACH FREE', price: '$0', period: 'forever', color: '#58a6ff', highlight: false, audience: 'Coaches',
              features: ['Verified coach profile', '10 athlete tests/month', 'Appear in Coach Finder', 'Set your own testing prices', 'Connect your scheduler'] },
            { name: 'COACH DASHBOARD', price: '$149.99', period: '/mo', color: '#58a6ff', highlight: false, audience: 'Coaches',
              features: ['Everything in Coach Free', 'Unlimited athlete tests', 'Daily testing per athlete', 'Full prospect search', 'Athlete management tools'] },
          ].map(p => (
            <div key={p.name} style={{
              background: p.highlight ? 'rgba(232,160,32,0.06)' : '#161b22',
              border: \`1px solid \${p.highlight ? '#e8a020' : '#21262d'}\`,
              borderRadius: '8px', padding: '1.75rem', position: 'relative',
              boxShadow: p.highlight ? '0 0 40px rgba(232,160,32,0.08)' : 'none'
            }}>
              {p.highlight && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#e8a020', color: '#0d1117', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', padding: '0.2rem 0.75rem', borderRadius: '100px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>MOST POPULAR</div>}
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: '#8b949e', fontFamily: 'monospace', marginBottom: '0.25rem' }}>{p.audience}</div>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: p.color, fontFamily: 'monospace', marginBottom: '1rem' }}>{p.name}</div>
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'monospace' }}>{p.price}</span>
                <span style={{ color: '#8b949e', fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: '0.75rem', color: '#8b949e', fontFamily: 'monospace', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', lineHeight: 1.4 }}>
                    <span style={{ color: p.color, marginTop: '1px' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                background: p.highlight ? '#e8a020' : 'transparent',
                border: \`1px solid \${p.highlight ? '#e8a020' : '#30363d'}\`,
                color: p.highlight ? '#0d1117' : '#f0f6fc',
                padding: '0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em'
              }}>
                GET STARTED FREE
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: '5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(232,160,32,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⬡</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Your diamond moment<br />starts here.
          </h2>
          <p style={{ color: '#8b949e', fontFamily: 'monospace', marginBottom: '2.5rem', fontSize: '0.875rem', lineHeight: 1.7 }}>
            Whether you're an athlete chasing a college roster spot or a coach building your reputation — Diamond Verified gives you the tools to make it happen. Free to start. No credit card required.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sign-up" style={{ background: '#e8a020', color: '#0d1117', padding: '0.875rem 2rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              CREATE ATHLETE PROFILE →
            </Link>
            <Link href="/sign-up" style={{ border: '1px solid #58a6ff', color: '#58a6ff', padding: '0.875rem 2rem', borderRadius: '4px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              CREATE COACH PROFILE →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #21262d', padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
          <span>⬡</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.05em', color: '#e8a020' }}>DIAMOND VERIFIED</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#8b949e', fontFamily: 'monospace' }}>© 2026 Diamond Verified. All rights reserved. | baseballrecruit.com</p>
      </footer>

    </main>
  );
}
`;

const filePath = path.join(__dirname, 'app', 'page.tsx');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ app/page.tsx written successfully');