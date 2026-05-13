import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';
import type { AthletePitch } from '@/lib/metrics';

export const runtime = 'nodejs';

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  try {
    const state = await clerk.authenticateRequest(req, {
      secretKey:      process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    if (!state.isSignedIn) return null;
    return state.toAuth().userId;
  } catch { return null; }
}

/** Verify the Clerk user has a row in the coaches table. Mirrors saved-athletes. */
async function getCoach(userId: string) {
  const db = createAdminClient();
  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (!coach) return null;
  return { id: coach.id as string };
}

// GET /api/coach/athletes/[athleteId]/pitches
// Returns all athlete_pitches rows for the target athlete, ordered by pitch_slot ASC.
// Any verified coach can view (no connection check — this data is also surfaced on
// the public profile). Auth pattern mirrors app/api/coach/saved-athletes/route.ts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const coach = await getCoach(userId);
    if (!coach) return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 });

    const { athleteId } = await params;
    if (!athleteId) return NextResponse.json({ error: 'athleteId required.' }, { status: 400 });

    const db = createAdminClient();
    const { data, error } = await db
      .from('athlete_pitches')
      .select('*')
      .eq('athlete_clerk_id', athleteId)
      .order('pitch_slot', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ pitches: (data ?? []) as AthletePitch[] });
  } catch (e) {
    const x = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
    console.error('[GET /api/coach/athletes/[athleteId]/pitches]', e);
    return NextResponse.json(
      { error: x?.message ?? 'Unknown error', code: x?.code, hint: x?.hint, details: x?.details, stack: x?.stack },
      { status: 500 },
    );
  }
}
