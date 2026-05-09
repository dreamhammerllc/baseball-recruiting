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

// GET /api/coach/saved-athletes?sort=recent|alphabetical|position
// Returns full athlete data for everyone the coach has saved, shaped to match
// /api/coach/discover so the same card layout renders both views identically.
// Two queries with JS merge — no SQL JOINs (PGRST125-safe).
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const coach = await getCoach(userId);
    if (!coach) return NextResponse.json({ error: 'Coach not found.' }, { status: 404 });

    const db = createAdminClient();
    const sort = req.nextUrl.searchParams.get('sort') ?? 'recent';

    // ── Q1: saved entries for this coach ────────────────────────────────────
    const { data: saved, error: savedErr } = await db
      .from('saved_athletes')
      .select('athlete_clerk_id, saved_at')
      .eq('coach_id', coach.id);
    if (savedErr) throw savedErr;

    if (!saved || saved.length === 0) {
      return NextResponse.json({ results: [], total: 0, is_paid: coach.isPaid, limit: coach.isPaid ? null : FREE_LIMIT });
    }

    const ids       = saved.map(s => s.athlete_clerk_id as string);
    const savedById = new Map(saved.map(s => [s.athlete_clerk_id as string, s.saved_at as string]));

    // ── Q2: athlete rows — same SELECT list as /api/coach/discover for parity ─
    const { data: rows, error: athErr } = await db
      .from('athletes')
      .select(
        'clerk_user_id, username, first_name, last_name, photo_url, position, secondary_position, grad_year, home_state, bats, throws, gpa_unweighted, sixty_yard_dash_seconds, fastball_velocity_mph, exit_velocity_mph, verification_tier',
      )
      .in('clerk_user_id', ids);
    if (athErr) throw athErr;

    // ── JS merge: drop orphans (saved row whose athlete is gone) + attach saved_at ─
    const results = (rows ?? [])
      .filter(r => savedById.has(r.clerk_user_id as string))
      .map(r => ({
        clerk_user_id:      r.clerk_user_id,
        username:           r.username,
        first_name:         r.first_name,
        last_name:          r.last_name,
        photo_url:          r.photo_url,
        position:           r.position,
        secondary_position: r.secondary_position,
        grad_year:          r.grad_year,
        state:              r.home_state,
        bats:               r.bats,
        throws:             r.throws,
        gpa:                r.gpa_unweighted,
        sixty_yard:         r.sixty_yard_dash_seconds,
        fb_velo:            r.fastball_velocity_mph,
        exit_velo:          r.exit_velocity_mph,
        verification_tier:  r.verification_tier,
        saved_at:           savedById.get(r.clerk_user_id as string)!,
      }));

    if (sort === 'alphabetical') {
      results.sort((a, b) => {
        const an = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim().toLowerCase();
        const bn = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim().toLowerCase();
        return an.localeCompare(bn);
      });
    } else if (sort === 'position') {
      results.sort((a, b) => (a.position ?? 'zzz').localeCompare(b.position ?? 'zzz'));
    } else {
      results.sort((a, b) => (b.saved_at ?? '').localeCompare(a.saved_at ?? ''));
    }

    return NextResponse.json({
      results,
      total:   results.length,
      is_paid: coach.isPaid,
      limit:   coach.isPaid ? null : FREE_LIMIT,
    });
  } catch (e) {
    const x = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
    console.error('[GET /api/coach/saved-athletes]', e);
    return NextResponse.json(
      { error: x?.message ?? 'Unknown error', code: x?.code, hint: x?.hint, details: x?.details, stack: x?.stack },
      { status: 500 },
    );
  }
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
