import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import { TIER_FEATURES, normalizeTier } from '@/lib/pricing';
import SchoolMatchesClient from './SchoolMatchesClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface SavedMatch {
  id:          string;
  school_name: string;
  division:    string | null;
  fit_score:   number;
  reason:      string | null;
}

export default async function SchoolMatchesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const db = createAdminClient();

  const { data: athleteRow } = await db
    .from('athletes')
    .select('subscription_tier')
    .eq('clerk_user_id', userId)
    .single();

  const tier = normalizeTier(athleteRow?.subscription_tier);
  const hasAccess = TIER_FEATURES[tier].schoolMatches;

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>&#128274;</span>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: '0.18em', color: '#e8a020', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
              Elite Feature
            </p>
            <h1 style={{ color: '#f0f6fc', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
              School Matches Calculator
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem', maxWidth: '400px' }}>
              Upgrade to Elite to access the School Matches calculator and find colleges that fit your athletic and academic profile.
            </p>
          </div>
          <Link
            href="/dashboard/athlete/upgrade"
            style={{ backgroundColor: '#e8a020', color: '#0d1117', padding: '0.75rem 1.75rem', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}
          >
            Upgrade to Elite &#8594;
          </Link>
          <Link href="/dashboard/athlete" style={{ color: '#6b7280', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'monospace' }}>
            &#8592; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { data: matches, error } = await db
    .from('school_matches')
    .select('id, school_name, division, fit_score, reason')
    .eq('athlete_clerk_id', userId)
    .order('fit_score', { ascending: false });

  const savedMatches: SavedMatch[] = error ? [] : (matches ?? []);

  return <SchoolMatchesClient savedMatches={savedMatches} />;
}
