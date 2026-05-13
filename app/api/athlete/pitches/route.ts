export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import type { AthletePitch } from '@/lib/metrics';

// GET — return all pitches for the authenticated athlete, ordered by pitch_slot ASC.
// Mirrors the auth + response shape of /api/athlete/metrics.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('athlete_pitches')
    .select('*')
    .eq('athlete_clerk_id', userId)
    .order('pitch_slot', { ascending: true });

  if (error) {
    console.error('[athlete/pitches] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch pitches.' }, { status: 500 });
  }

  return NextResponse.json({ pitches: (data ?? []) as AthletePitch[] });
}
