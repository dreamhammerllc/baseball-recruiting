import CoachSidebar from '@/components/layout/CoachSidebar';
import DiscoverClient from './DiscoverClient';

export const runtime = 'nodejs';

export default function DiscoverPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0e14' }}>
      <CoachSidebar />
      <main style={{ flex: 1, padding: '2rem 1.5rem 4rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{
              color: '#ffffff', fontSize: '1.6rem', fontWeight: 700,
              margin: '0 0 0.35rem', letterSpacing: '-0.02em',
            }}>
              Discover Athletes
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Find athletes you&apos;re not yet connected to. Save the ones you want to track.
            </p>
          </div>

          <DiscoverClient />
        </div>
      </main>
    </div>
  );
}
