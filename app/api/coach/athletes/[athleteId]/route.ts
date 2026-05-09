export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

function err500(e: unknown) {
  const x = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
  return NextResponse.json(
    {
      error:   x?.message ?? 'Unknown error',
      code:    x?.code,
      hint:    x?.hint,
      details: x?.details,
      stack:   x?.stack,
    },
    { status: 500 },
  );
}

// ── Access check ───────────────────────────────────────────────────────────────
// Coach has access to an athlete IF connected via coach_athlete_connections,
// OR if they have saved them (saved_athletes). Spec: connected gets the rich
// detail view; saved-only could be added later. For now: connected only.
async function coachHasAccess(coachClerkId: string, athleteClerkId: string) {
  const db = createAdminClient();

  const { data, error } = await db
    .from('coach_athlete_connections')
    .select('id')
    .eq('coach_id',   coachClerkId)
    .eq('athlete_id', athleteClerkId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

// ── GET /api/coach/athletes/[athleteId] ────────────────────────────────────────
// Returns the full athlete profile + contact info IF the signed-in coach is
// connected to that athlete. 403 otherwise. athleteId = athlete's Clerk user ID.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const { userId: coachId } = await auth();
    if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { athleteId } = await params;
    if (!athleteId) return NextResponse.json({ error: 'athleteId required' }, { status: 400 });

    const hasAccess = await coachHasAccess(coachId, athleteId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You are not connected to this athlete.' },
        { status: 403 },
      );
    }

    const db = createAdminClient();

    // Athlete row — only the columns we display.
    const { data: athlete, error: athErr } = await db
      .from('athletes')
      .select(
        [
          'id',
          'clerk_user_id',
          'first_name',
          'last_name',
          'username',
          'email',
          'parent_email',
          'phone',
          'photo_url',
          'position',
          'secondary_position',
          'grad_year',
          'home_state',
          'height_inches',
          'weight_lbs',
          'throws',
          'bats',
          'gpa_unweighted',
          'gpa_weighted',
          'sat_score',
          'act_score',
          'exit_velocity_mph',
          'fastball_velocity_mph',
          'sixty_yard_dash_seconds',
          'highlight_video_url',
          'bio',
          'subscription_tier',
          'verification_tier',
          'is_verified',
          'gamechanger_url',
          'iscore_url',
          'perfectgame_url',
        ].join(','),
      )
      .eq('clerk_user_id', athleteId)
      .maybeSingle();

    if (athErr) throw athErr;
    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    // Personal-best metrics (separate query — no real FK, two-query merge pattern).
    const { data: metricsRows } = await db
      .from('athlete_metrics')
      .select('*')
      .eq('athlete_clerk_id', athleteId)
      .eq('is_personal_best', true);

    return NextResponse.json({
      athlete,
      personalBestMetrics: metricsRows ?? [],
    });
  } catch (e) {
    console.error('[GET /api/coach/athletes/[athleteId]]', e);
    return err500(e);
  }
}

// ── DELETE /api/coach/athletes/[athleteId] ─────────────────────────────────────
// Removes the coach-athlete connection (this coach removes the athlete from
// their roster). Auth-checks that the connection belongs to the signed-in coach.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const { userId: coachId } = await auth();
    if (!coachId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { athleteId } = await params;
    if (!athleteId) return NextResponse.json({ error: 'athleteId required' }, { status: 400 });

    const db = createAdminClient();
    const { error } = await db
      .from('coach_athlete_connections')
      .delete()
      .eq('coach_id',   coachId)
      .eq('athlete_id', athleteId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/coach/athletes/[athleteId]]', e);
    return err500(e);
  }
}
