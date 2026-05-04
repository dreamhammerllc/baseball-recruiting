import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/auth';

// GET /api/coach/connections
// Returns all athletes connected to the signed-in coach
export async function GET(req: NextRequest) {
  const coachId = await getAuthenticatedUserId(req);
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

  if (!connections || connections.length === 0) {
    return NextResponse.json({ athletes: [] });
  }

  // Fetch athlete profiles for all connected athletes
  const athleteIds = connections.map(c => c.athlete_id);
  const { data: profiles, error: profileError } = await supabase
    .from('athletes')
    .select('clerk_user_id, first_name, last_name, photo_url, position, grad_year')
    .in('clerk_user_id', athleteIds);

  if (profileError) {
    console.error('Profile fetch error:', profileError);
    return NextResponse.json({ error: 'Failed to fetch athlete profiles' }, { status: 500 });
  }

  const profileMap = new Map(
    (profiles ?? []).map(p => [p.clerk_user_id, p])
  );

  const athletes = connections.map(conn => {
    const p = profileMap.get(conn.athlete_id);
    return {
      connectionId:  conn.id,
      athleteId:     conn.athlete_id,
      connectedAt:   conn.connected_at,
      name:          p ? ([p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown Athlete') : 'Unknown Athlete',
      photo:         p?.photo_url ?? null,
      position:      p?.position ?? null,
      gradYear:      p?.grad_year ?? null,
      username:      null,
    };
  });

  return NextResponse.json({ athletes });
}

// DELETE /api/coach/connections?athleteId=user_XXX
// Removes a coach-athlete connection
export async function DELETE(req: NextRequest) {
  const coachId = await getAuthenticatedUserId(req);
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
