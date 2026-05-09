import CoachSidebar from '@/components/layout/CoachSidebar';
import SavedClient from './SavedClient';

export const runtime = 'nodejs';

export default function SavedPage() {
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
              Saved Athletes
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Athletes you&apos;re tracking. To add one to your roster, you&apos;ll need their share code from the athlete directly.
            </p>
          </div>

          <SavedClient />
        </div>
      </main>
    </div>
  );
}
