export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiError } from '@/lib/apiError';
import type { AthletePitch } from '@/lib/metrics';

// ── POST /api/athlete/pitches/[id]/move ──────────────────────────────────────
// Move a pitch one slot up or down. Body: { direction: 'up' | 'down' }.
//
// The actual reassignment/swap runs inside the move_pitch_slot SECURITY DEFINER
// function (migration 009) so a full-arsenal swap doesn't trip the
// (athlete_clerk_id, pitch_slot) unique constraint. This route fetch-checks
// ownership + boundary first (mirroring the PATCH route) to return precise
// status codes; the RPC re-checks ownership as defense-in-depth.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing pitch id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const direction = body.direction;
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json(
      { error: "direction must be 'up' or 'down'." },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // 1. Fetch — confirms existence + ownership and gives the current slot for
  //    the boundary check. Same fetch-first pattern as the PATCH route.
  const { data: current, error: fetchErr } = await db
    .from('athlete_pitches')
    .select('id, athlete_clerk_id, pitch_slot')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[athlete/pitches/:id/move] fetch error:', fetchErr.message);
    return apiError('Database error.', fetchErr);
  }
  if (!current) return NextResponse.json({ error: 'Pitch not found.' }, { status: 404 });

  const row = current as { athlete_clerk_id: string; pitch_slot: number };
  if (row.athlete_clerk_id !== userId) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // 2. Boundary check — nothing above slot 1, nothing below slot 5.
  if (direction === 'up' && row.pitch_slot <= 1) {
    return NextResponse.json(
      { error: 'Pitch is already in the top slot.' },
      { status: 400 },
    );
  }
  if (direction === 'down' && row.pitch_slot >= 5) {
    return NextResponse.json(
      { error: 'Pitch is already in the bottom slot.' },
      { status: 400 },
    );
  }

  // 3. Atomic move via the SECURITY DEFINER RPC. Returns the full arsenal,
  //    slot-ordered, so no follow-up query is needed.
  const { data: moved, error: rpcErr } = await db.rpc('move_pitch_slot', {
    p_athlete:   userId,
    p_pitch_id:  id,
    p_direction: direction,
  });

  if (rpcErr) {
    // The pre-checks above should have caught every mappable case; anything
    // surfacing here is unexpected -> 500 with the standard error shape.
    console.error('[athlete/pitches/:id/move] rpc error:', rpcErr.message);
    return apiError('Failed to move pitch.', rpcErr);
  }

  return NextResponse.json({
    success: true,
    pitches: (moved ?? []) as AthletePitch[],
  });
}
