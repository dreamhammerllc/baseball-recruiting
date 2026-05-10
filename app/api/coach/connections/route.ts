export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/coach/connections
// Returns all athletes connected to the signed-in coach
export async function GET() {
  try {
    const { userId: coachId } = await auth();
    if (!coachId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all connection rows for this coach
    const { data: connections, error: connError } = await supabase
      .from('coach_athlete_connections')
      .select('id, athlete_id, connected_at')
      .eq('coach_id', coachId)
      .order('connected_at', { ascending: false });

    if (connError) {
      console.error('Connections fetch error:', connError);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }
    console.log('[connections] connections fetched:', connections?.length ?? 0);

    if (!connections || connections.length === 0) {
      return NextResponse.json({ athletes: [] });
    }

    // Step 2 — Fetch athlete profiles (two separate queries, no JOIN)
    const athleteIds = connections.map(c => c.athlete_id);
    const { data: profiles, error: profileError } = await supabase
      .from('athletes')
      .select('clerk_user_id, full_name, first_name, last_name, username, position, photo_url, grad_year')
      .in('clerk_user_id', athleteIds);
    console.log('[connections] profiles fetched:', profiles?.length ?? 0);

    if (profileError) {
      console.error('[connections] Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch athlete profiles' }, { status: 500 });
    }

    const profileMap = new Map(
      (profiles ?? []).map(p => [p.clerk_user_id, p])
    );

    // Step 3 — Merge in JS
    const athletes = connections.map(conn => {
      const p = profileMap.get(conn.athlete_id);
      const name = p
        ? (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown Athlete')
        : 'Unknown Athlete';
      return {
        connectionId:  conn.id,
        athleteId:     conn.athlete_id,
        connectedAt:   conn.connected_at,
        name,
        photo:         p?.photo_url ?? null,
        position:      p?.position ?? null,
        gradYear:      p?.grad_year ?? null,
        username:      p?.username ?? null,
      };
    });

    return NextResponse.json({ athletes });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; hint?: string; details?: string; stack?: string };
    console.error('CONNECTIONS_ROUTE_ERROR:', e);
    return NextResponse.json({
      error:   err?.message   ?? String(e),
      code:    err?.code,
      hint:    err?.hint,
      details: err?.details,
      stack:   err?.stack,
    }, { status: 500 });
  }
}

// DELETE /api/coach/connections?athleteId=user_XXX
// Removes a coach-athlete connection
export async function DELETE(req: NextRequest) {
  const { userId: coachId } = await auth();
  if (!coachId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const athleteId = req.nextUrl.searchParams.get('athleteId');
  if (!athleteId) {
    return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('coach_athlete_connections')
    .delete()
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId);

  if (error) {
    console.error('Connection delete error:', error);
    return NextResponse.json({ error: 'Failed to remove connection' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
