import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

const FREE_LIMIT = 15;

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

/** Safely fetch the coach row and their subscription tier, resilient to missing columns. */
async function getCoach(userId: string) {
  const db = createAdminClient();

  // First get the coach ID (always exists if profile is set up)
  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return null;

  // Try to get tier — if subscription_tier column doesn't exist yet, default to free
  let isPaid = false;
  try {
    const { data: tierRow } = await db
      .from('coaches')
      .select('subscription_tier')
      .eq('id', coach.id)
      .maybeSingle();
    isPaid = (tierRow?.subscription_tier ?? 'free') !== 'free';
  } catch { isPaid = false; }

  return { id: coach.id, isPaid };
}

// GET /api/coach/saved-athletes — list all saved athletes + groups
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const coach = await getCoach(userId);
  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  const db = createAdminClient();

  // Try to fetch saved athletes — table may not exist yet
  let athletes: unknown[] = [];
  let groups: unknown[] = [];
  try {
    const [aRes, gRes] = await Promise.all([
      db.from('saved_athletes').select('*').eq('coach_id', coach.id).order('saved_at', { ascending: false }),
      db.from('athlete_groups').select('*').eq('coach_id', coach.id).order('created_at'),
    ]);
    athletes = aRes.data ?? [];
    groups   = gRes.data ?? [];
  } catch { /* tables not yet created — return empty */ }

  const count = athletes.length;

  return NextResponse.json({
    athletes,
    groups:  coach.isPaid ? groups : [],
    count,
    limit:   coach.isPaid ? null : FREE_LIMIT,
    is_paid: coach.isPaid,
  });
}

// POST /api/coach/saved-athletes — save an athlete
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { athlete_clerk_id, athlete_name, athlete_photo, athlete_username } =
    await req.json() as {
      athlete_clerk_id: string;
      athlete_name: string;
      athlete_photo: string | null;
      athlete_username: string | null;
    };

  if (!athlete_clerk_id) return NextResponse.json({ error: 'athlete_clerk_id required.' }, { status: 400 });

  const coach = await getCoach(userId);
  if (!coach) return NextResponse.json({ error: 'Coach profile not found. Please complete your profile setup first.' }, { status: 404 });

  const db = createAdminClient();

  if (!coach.isPaid) {
    try {
      const { count } = await db
        .from('saved_athletes')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', coach.id);

      if ((count ?? 0) >= FREE_LIMIT) {
        return NextResponse.json({
          error: `Free accounts can save up to ${FREE_LIMIT} athletes. Remove an athlete or upgrade to add more.`,
          limit_reached: true,
        }, { status: 403 });
      }
    } catch { /* table not yet created, allow save */ }
  }

  const { data, error } = await db
    .from('saved_athletes')
    .upsert({
      coach_id:         coach.id,
      athlete_clerk_id,
      athlete_name,
      athlete_photo:    athlete_photo ?? null,
      athlete_username: athlete_username ?? null,
    }, { onConflict: 'coach_id,athlete_clerk_id' })
    .select()
    .single();

  if (error) {
    console.error('[saved-athletes POST]', error.message);
    return NextResponse.json({ error: 'Failed to save athlete. The athlete roster table may not be set up yet — please contact support.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, athlete: data });
}

// DELETE /api/coach/saved-athletes?athlete_clerk_id=xxx — remove saved athlete
export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const athleteClerkId = new URL(req.url).searchParams.get('athlete_clerk_id');
  if (!athleteClerkId) return NextResponse.json({ error: 'athlete_clerk_id required.' }, { status: 400 });

  const coach = await getCoach(userId);
  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  const db = createAdminClient();
  await db
    .from('saved_athletes')
    .delete()
    .eq('coach_id', coach.id)
    .eq('athlete_clerk_id', athleteClerkId);

  return NextResponse.json({ success: true });
}

// PATCH /api/coach/saved-athletes — move athlete to a group
export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { athlete_clerk_id, group_id } = await req.json() as {
    athlete_clerk_id: string;
    group_id: string | null;
  };

  const coach = await getCoach(userId);
  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });
  if (!coach.isPaid) {
    return NextResponse.json({ error: 'Groups are a paid feature.' }, { status: 403 });
  }

  const db = createAdminClient();
  await db
    .from('saved_athletes')
    .update({ group_id: group_id ?? null })
    .eq('coach_id', coach.id)
    .eq('athlete_clerk_id', athlete_clerk_id);

  return NextResponse.json({ success: true });
}
