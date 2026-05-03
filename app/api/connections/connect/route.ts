import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const coachId = await getAuthenticatedUserId(req);
  if (!coachId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let athleteId: string;
  try {
    const body = await req.json();
    athleteId = body.athleteId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!athleteId || typeof athleteId !== 'string') {
    return NextResponse.json({ error: 'athleteId is required' }, { status: 400 });
  }

  // Prevent self-connection
  if (coachId === athleteId) {
    return NextResponse.json({ error: 'Cannot connect to yourself' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the target is a real athlete
  const { data: athlete } = await supabase
    .from('athletes')
    .select('clerk_user_id')
    .eq('clerk_user_id', athleteId)
    .single();

  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
  }

  // Upsert — unique constraint on (coach_id, athlete_id) prevents duplicates
  const { error } = await supabase
    .from('coach_athlete_connections')
    .upsert(
      { coach_id: coachId, athlete_id: athleteId },
      { onConflict: 'coach_id,athlete_id' }
    );

  if (error) {
    console.error('Connection upsert error:', error);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
