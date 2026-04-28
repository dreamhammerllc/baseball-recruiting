/**
 * College Coach — Prospect Search Dashboard
 *
 * REQUIRED SQL (run once in the Supabase SQL editor if not already done):
 *
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
 *   ALTER TABLE athletes ADD COLUMN IF NOT EXISTS verified_at timestamptz;
 *
 *   CREATE TABLE IF NOT EXISTS saved_prospects (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     coach_clerk_id   text        NOT NULL,
 *     athlete_clerk_id text        NOT NULL,
 *     saved_at         timestamptz DEFAULT now(),
 *     UNIQUE(coach_clerk_id, athlete_clerk_id)
 *   );
 */

import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import CollegeSidebar from '@/components/layout/CollegeSidebar';
import ProspectSearch, { type Prospect } from './ProspectSearch';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function CollegeCoachDashboard() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const [prospects, savedProspectIds] = await Promise.all([
    fetchProspects(),
    fetchSavedIds(user.id),
  ]);

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
            Find Your Next Recruit
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Search and filter verified athletes by position, stats, and academics
          </p>
        </div>

        {/* Count strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#e8a020',
              boxShadow: '0 0 6px rgba(232,160,32,0.5)',
            }} />
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{prospects.length}</span>
              {' '}verified athlete{prospects.length !== 1 ? 's' : ''} in the database
            </span>
          </div>
        </div>

        {/* Client-side filter + results */}
        <ProspectSearch prospects={prospects} savedProspectIds={savedProspectIds} />

      </main>
    </div>
  );
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchSavedIds(coachClerkId: string): Promise<string[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('saved_prospects')
      .select('athlete_clerk_id')
      .eq('coach_clerk_id', coachClerkId);

    if (error) {
      // Table may not exist yet — degrade gracefully
      console.error('[college] fetchSavedIds failed:', error.message);
      return [];
    }
    return (data ?? []).map((r) => r.athlete_clerk_id as string);
  } catch (err) {
    console.error('[college] fetchSavedIds unexpected error:', err);
    return [];
  }
}

async function fetchProspects(): Promise<Prospect[]> {
  try {
    const db = createAdminClient();

    // 1. Fetch all athletes (base fields only, no is_verified yet)
    const { data: athletes, error: athleteError } = await db
      .from('athletes')
      .select(
        'clerk_user_id, first_name, last_name, position, grad_year, home_state, ' +
        'gpa_weighted, gpa_unweighted, exit_velocity_mph, fastball_velocity_mph, division_pref',
      )
      .order('first_name', { ascending: true });

    if (athleteError || !athletes || athletes.length === 0) {
      if (athleteError) console.error('[college] athletes fetch failed:', athleteError.message);
      return [];
    }

    // 2. Filter to verified-only via a separate resilient query.
    //    If is_verified column doesn't exist yet, fall back to showing all athletes
    //    so the page isn't blank while the SQL migration is pending.
    let verifiedIds: Set<string> | null = null;
    try {
      const { data: verRows } = await db
        .from('athletes')
        .select('clerk_user_id, is_verified')
        .eq('is_verified', true);

      if (verRows) {
        verifiedIds = new Set(verRows.map((r) => r.clerk_user_id as string));
      }
    } catch {
      // Column not yet created — show all athletes as a graceful fallback
    }

    const filtered = verifiedIds
      ? athletes.filter((a) => verifiedIds!.has(a.clerk_user_id))
      : athletes;

    if (filtered.length === 0) return [];

    // 3. Look up the internal UUIDs for these athletes so we can join school_matches
    const athleteClerkIds = filtered.map((a) => a.clerk_user_id as string);

    const { data: idRows } = await db
      .from('athletes')
      .select('id, clerk_user_id')
      .in('clerk_user_id', athleteClerkIds);

    const clerkToDbId = new Map<string, string>(
      (idRows ?? []).map((r) => [r.clerk_user_id as string, r.id as string]),
    );
    const dbIds = Array.from(clerkToDbId.values());

    // 4. Fetch school_matches and compute top fit score per athlete
    const topFitByClerkId = new Map<string, number>();

    if (dbIds.length > 0) {
      const { data: matches } = await db
        .from('school_matches')
        .select('athlete_id, fit_score')
        .in('athlete_id', dbIds);

      if (matches) {
        const dbIdToClerk = new Map<string, string>(
          (idRows ?? []).map((r) => [r.id as string, r.clerk_user_id as string]),
        );

        for (const m of matches) {
          const clerkId = dbIdToClerk.get(m.athlete_id as string);
          if (!clerkId) continue;
          const prev = topFitByClerkId.get(clerkId) ?? 0;
          if ((m.fit_score as number) > prev) {
            topFitByClerkId.set(clerkId, m.fit_score as number);
          }
        }
      }
    }

    // 5. Assemble final Prospect objects
    return filtered.map((a) => ({
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
      top_fit_score: topFitByClerkId.get(a.clerk_user_id as string) ?? null,
    }));
  } catch (err) {
    console.error('[college] fetchProspects unexpected error:', err);
    return [];
  }
}
