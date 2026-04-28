import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CoachSidebar from '@/components/layout/CoachSidebar';

export const dynamic = 'force-dynamic';

export default async function CoachProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CoachSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Coach Profile
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Your verified coaching identity shown to athletes and colleges
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>
          <a
            href="/dashboard/coach/setup"
            style={{
              backgroundColor: '#111827',
              border: '1px solid rgba(232,160,32,0.3)',
              borderRadius: '0.75rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              textDecoration: 'none',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(232,160,32,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', margin: '0 0 0.2rem' }}>Edit Profile Setup</p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Update your name, title, organization, bio, and photo</p>
            </div>
            <span style={{ color: '#e8a020', fontSize: '0.85rem' }}>→</span>
          </a>

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
            <h2 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              Public Profile View Coming Soon
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, maxWidth: '380px', lineHeight: '1.6' }}>
              Athletes will soon be able to view your verified coaching credentials directly from their verification badges.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
