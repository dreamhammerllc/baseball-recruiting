import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import AthleteSidebar from '@/components/layout/AthleteSidebar';

export const dynamic = 'force-dynamic';

interface SchoolMatch {
  id:          string;
  school_name: string;
  division:    string | null;
  fit_score:   number;
  reason:      string | null;
}

function FitBar({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const color   = clamped >= 80 ? '#e8a020' : clamped >= 60 ? '#58a6ff' : '#6b7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ flex: 1, backgroundColor: '#1e2530', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, backgroundColor: color, height: '100%', borderRadius: '999px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ color, fontSize: '0.8rem', fontWeight: 700, minWidth: '36px', textAlign: 'right' }}>
        {clamped}%
      </span>
    </div>
  );
}

export default async function SchoolMatchesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = createAdminClient();
  const { data: matches, error } = await db
    .from('school_matches')
    .select('id, school_name, division, fit_score, reason')
    .eq('athlete_clerk_id', userId)
    .order('fit_score', { ascending: false });

  const list: SchoolMatch[] = error ? [] : (matches ?? []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            School Matches
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Programs matched to your verified metrics and academic profile
          </p>
        </div>

        {list.length > 0 ? (
          <>
            {/* Match count badge */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                backgroundColor: 'rgba(232,160,32,0.12)',
                border: '1px solid rgba(232,160,32,0.3)',
                borderRadius: '999px',
                color: '#e8a020',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.25rem 0.85rem',
              }}>
                {list.length} {list.length === 1 ? 'match' : 'matches'} found
              </span>
            </div>

            {/* Match cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {list.map((m, i) => (
                <div
                  key={m.id ?? i}
                  style={{
                    backgroundColor: '#111827',
                    border: '1px solid #1e2530',
                    borderRadius: '0.75rem',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {/* School name + division + label */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.2rem' }}>
                        {m.school_name}
                      </p>
                      {m.division && (
                        <span style={{
                          backgroundColor: '#1e2530',
                          borderRadius: '0.3rem',
                          color: '#9ca3af',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}>
                          {m.division}
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#4b5563', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      View Program
                    </span>
                  </div>

                  {/* Fit score bar */}
                  <div>
                    <p style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 500, margin: '0 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Fit Score
                    </p>
                    <FitBar score={m.fit_score} />
                  </div>

                  {/* Reason */}
                  {m.reason && (
                    <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0, lineHeight: '1.5', borderTop: '1px solid #1e2530', paddingTop: '0.75rem' }}>
                      {m.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1e2530',
            borderRadius: '0.75rem',
            padding: '3rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center',
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h2 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              You have no matches yet
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, maxWidth: '380px', lineHeight: '1.6' }}>
              Use the calculator to run your first school match analysis. Matches are generated based on your verified metrics, GPA, and division preference.
            </p>
            <a
              href="/dashboard/athlete/calculator"
              style={{
                marginTop: '0.25rem',
                backgroundColor: '#e8a020',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#000000',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '0.6rem 1.5rem',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Go to Calculator
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
