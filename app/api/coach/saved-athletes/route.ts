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

// GET /api/coach/saved-athletes — list all saved athletes + groups
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id, subscription_tier')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  const [{ data: athletes }, { data: groups }] = await Promise.all([
    db.from('saved_athletes')
      .select('*')
      .eq('coach_id', coach.id)
      .order('saved_at', { ascending: false }),
    db.from('athlete_groups')
      .select('*')
      .eq('coach_id', coach.id)
      .order('created_at'),
  ]);

  const isPaid = coach.subscription_tier !== 'free';

  return NextResponse.json({
    athletes:  athletes  ?? [],
    groups:    isPaid ? (groups ?? []) : [],
    count:     athletes?.length ?? 0,
    limit:     isPaid ? null : FREE_LIMIT,
    is_paid:   isPaid,
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

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id, subscription_tier')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

  const isPaid = coach.subscription_tier !== 'free';

  if (!isPaid) {
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

  if (error) return NextResponse.json({ error: 'Failed to save athlete.' }, { status: 500 });
  return NextResponse.json({ success: true, athlete: data });
}

// DELETE /api/coach/saved-athletes?athlete_clerk_id=xxx — remove saved athlete
export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const athleteClerkId = new URL(req.url).searchParams.get('athlete_clerk_id');
  if (!athleteClerkId) return NextResponse.json({ error: 'athlete_clerk_id required.' }, { status: 400 });

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

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

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id, subscription_tier')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });
  if (coach.subscription_tier === 'free') {
    return NextResponse.json({ error: 'Groups are a paid feature.' }, { status: 403 });
  }

  await db
    .from('saved_athletes')
    .update({ group_id: group_id ?? null })
    .eq('coach_id', coach.id)
    .eq('athlete_clerk_id', athlete_clerk_id);

  return NextResponse.json({ success: true });
}
