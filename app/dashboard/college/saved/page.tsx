import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CollegeSidebar from '@/components/layout/CollegeSidebar';
import SavedProspectsList, { type SavedProspect } from './SavedProspectsList';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SavedProspectsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const prospects = await fetchSavedProspects(userId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <CollegeSidebar />

      <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            color: '#ffffff',
            fontSize: '1.6rem',
            fontWeight: 700,
            margin: '0 0 0.35rem',
            letterSpacing: '-0.02em',
          }}>
            Saved Prospects
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            {prospects.length > 0
              ? `${prospects.length} athlete${prospects.length !== 1 ? 's' : ''} saved to your list`
              : 'Athletes you bookmark will appear here'}
          </p>
        </div>

        <SavedProspectsList initialProspects={prospects} />

      </main>
    </div>
  );
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchSavedProspects(coachClerkId: string): Promise<SavedProspect[]> {
  try {
    const db = createAdminClient();

    // 1. Get all saved athlete clerk IDs for this coach
    const { data: savedRows, error: savedError } = await db
      .from('saved_prospects')
      .select('athlete_clerk_id')
      .eq('coach_clerk_id', coachClerkId)
      .order('saved_at', { ascending: false });

    if (savedError) {
      console.error('[saved-prospects] saved_prospects fetch failed:', savedError.message);
      return [];
    }
    if (!savedRows || savedRows.length === 0) return [];

    const athleteClerkIds = savedRows.map((r) => r.athlete_clerk_id as string);

    // 2. Fetch athlete details for those IDs
    const { data: athletes, error: athleteError } = await db
      .from('athletes')
      .select(
        'id, clerk_user_id, first_name, last_name, position, grad_year, home_state, ' +
        'gpa_weighted, gpa_unweighted, exit_velocity_mph, fastball_velocity_mph, division_pref',
      )
      .in('clerk_user_id', athleteClerkIds);

    if (athleteError || !athletes || athletes.length === 0) {
      if (athleteError) console.error('[saved-prospects] athletes fetch failed:', athleteError.message);
      return [];
    }

    // 3. Fetch top fit score per athlete from school_matches
    const dbIds = athletes.map((a) => a.id as string);
    const topFitByDbId = new Map<string, number>();

    if (dbIds.length > 0) {
      const { data: matches } = await db
        .from('school_matches')
        .select('athlete_id, fit_score')
        .in('athlete_id', dbIds);

      for (const m of matches ?? []) {
        const prev = topFitByDbId.get(m.athlete_id as string) ?? 0;
        if ((m.fit_score as number) > prev) {
          topFitByDbId.set(m.athlete_id as string, m.fit_score as number);
        }
      }
    }

    // 4. Assemble — preserve the saved_at order from step 1
    const athleteByClerkId = new Map(
      athletes.map((a) => [a.clerk_user_id as string, a]),
    );

    return athleteClerkIds
      .map((clerkId) => {
        const a = athleteByClerkId.get(clerkId);
        if (!a) return null;
        return {
          clerk_user_id: a.clerk_user_id as string,
          first_name: a.first_name as string | null,
          last_name: a.last_name as string | null,
          position: a.position as string | null,
          grad_year: a.grad_year as string | null,
          home_state: a.home_state as string | null,
          gpa_weighted: a.gpa_weighted as number | null,
          gpa_unweighted: a.gpa_unweighted as number | null,
          exit_velocity_mph: a.exit_velocity_mph as number | null,
          fastball_velocity_mph: a.fastball_velocity_mph as number | null,
          division_pref: a.division_pref as string | null,
          top_fit_score: topFitByDbId.get(a.id as string) ?? null,
        } satisfies SavedProspect;
      })
      .filter((p): p is SavedProspect => p !== null);
  } catch (err) {
    console.error('[saved-prospects] unexpected error:', err);
    return [];
  }
}
