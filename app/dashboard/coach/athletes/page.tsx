import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';

export const dynamic = 'force-dynamic';

export default async function CoachAthletesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            My Athletes
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Athletes you have submitted verifications for
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
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Athlete Roster Coming Soon
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, maxWidth: '420px', lineHeight: '1.6' }}>
            A list of all athletes you have verified metrics for will appear here. Use the Dashboard to submit new verifications.
          </p>
          <a
            href="/dashboard/coach"
            style={{ marginTop: '0.5rem', color: '#e8a020', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
