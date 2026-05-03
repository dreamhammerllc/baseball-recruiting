import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import SchoolMatchesClient from './SchoolMatchesClient';

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
  const { data: matches, error } = await db
    .from('school_matches')
    .select('id, school_name, division, fit_score, reason')
    .eq('athlete_clerk_id', userId)
    .order('fit_score', { ascending: false });

  const savedMatches: SavedMatch[] = error ? [] : (matches ?? []);

  return <SchoolMatchesClient savedMatches={savedMatches} />;
}
