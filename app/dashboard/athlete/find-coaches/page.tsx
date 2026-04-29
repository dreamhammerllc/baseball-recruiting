import AthleteSidebar from '@/components/layout/AthleteSidebar';
import CoachFinderClient from './CoachFinderClient';

export default function FindCoachesPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <AthleteSidebar />
      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '800px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
              Find a Verified Coach
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Book a testing session with a Diamond Verified coach near you to get your metrics officially recorded and visible to college recruiters.
            </p>
          </div>

          {/* Info banner */}
          <div style={{ backgroundColor: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.75rem', display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#e8a020', fontSize: '1.1rem', flexShrink: 0 }}>◆</span>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: '#e8a020' }}>Why get verified?</strong> Only coach-verified metrics appear on your public recruiting profile. Self-reported stats are hidden from coaches. A verified session gives your numbers the gold badge that college programs trust.
            </p>
          </div>

          <CoachFinderClient />
        </div>
      </main>
    </div>
  );
}
