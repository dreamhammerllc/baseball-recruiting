import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';

export const dynamic = 'force-dynamic';

export default async function CoachEvaluationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Evaluations
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Review and manage all metric verifications you have submitted
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
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
          <h2 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Evaluation History Coming Soon
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, maxWidth: '420px', lineHeight: '1.6' }}>
            A full log of every verification you have submitted, their AI confidence scores, and approval status will display here.
          </p>
          <a
            href="/dashboard/coach"
            style={{ marginTop: '0.5rem', color: '#58a6ff', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
