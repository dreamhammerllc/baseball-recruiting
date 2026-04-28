import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AthleteSidebar from '@/components/layout/AthleteSidebar';

export const dynamic = 'force-dynamic';

export default async function SchoolMatchesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            School Matches
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Programs matched to your verified metrics and academic profile
          </p>
        </div>

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
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            School Matching Coming Soon
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, maxWidth: '420px', lineHeight: '1.6' }}>
            We will surface college programs that fit your verified performance metrics, GPA, division preference, and position. Check back soon.
          </p>
          <a
            href="/dashboard/athlete"
            style={{ marginTop: '0.5rem', color: '#58a6ff', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
