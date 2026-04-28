import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CollegeSidebar from '@/components/layout/CollegeSidebar';

export const dynamic = 'force-dynamic';

export default async function CollegeSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CollegeSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Manage your program account and preferences
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>
          {[
            { label: 'Program Account', desc: 'School name, division, and contact info', icon: '🏫' },
            { label: 'Subscription', desc: 'Manage your college recruiter plan', icon: '💳', href: '/pricing' },
            { label: 'Notifications', desc: 'Alerts for new prospects matching your filters', icon: '🔔' },
            { label: 'Saved Search Filters', desc: 'Manage preset filters for prospect searches', icon: '🔖' },
          ].map(({ label, desc, icon, href }) => (
            <div
              key={label}
              style={{
                backgroundColor: '#111827',
                border: '1px solid #1e2530',
                borderRadius: '0.75rem',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', margin: '0 0 0.2rem' }}>{label}</p>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>{desc}</p>
              </div>
              {href ? (
                <a href={href} style={{ color: '#e8a020', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                  Manage →
                </a>
              ) : (
                <span style={{ color: '#374151', fontSize: '0.8rem', fontWeight: 500 }}>Coming Soon</span>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
