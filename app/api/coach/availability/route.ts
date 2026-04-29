import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

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

export interface AvailabilityWindow {
  id?: string;
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

// GET — fetch coach's current availability + session settings
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id, advance_notice_hours, session_duration_minutes, is_accepting_bookings, ical_secret')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 });

  const { data: windows } = await db
    .from('coach_availability')
    .select('id, day_of_week, start_time, end_time')
    .eq('coach_id', coach.id)
    .order('day_of_week');

  return NextResponse.json({
    windows: windows ?? [],
    settings: {
      advance_notice_hours:     coach.advance_notice_hours ?? 24,
      session_duration_minutes: coach.session_duration_minutes ?? 60,
      is_accepting_bookings:    coach.is_accepting_bookings ?? true,
      ical_secret:              coach.ical_secret,
    },
  });
}

// POST — replace all availability windows + update session settings
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await req.json() as {
    windows: AvailabilityWindow[];
    advance_notice_hours?: number;
    session_duration_minutes?: number;
    is_accepting_bookings?: boolean;
  };

  const db = createAdminClient();

  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 });

  // Delete existing windows and replace with new ones
  await db.from('coach_availability').delete().eq('coach_id', coach.id);

  if (body.windows?.length) {
    const inserts = body.windows.map(w => ({
      coach_id:    coach.id,
      day_of_week: w.day_of_week,
      start_time:  w.start_time,
      end_time:    w.end_time,
    }));
    const { error } = await db.from('coach_availability').insert(inserts);
    if (error) {
      console.error('[coach/availability] insert error:', error.message);
      return NextResponse.json({ error: 'Failed to save availability.' }, { status: 500 });
    }
  }

  // Update session settings on coaches table
  await db.from('coaches').update({
    advance_notice_hours:     body.advance_notice_hours     ?? 24,
    session_duration_minutes: body.session_duration_minutes ?? 60,
    is_accepting_bookings:    body.is_accepting_bookings    ?? true,
    updated_at:               new Date().toISOString(),
  }).eq('id', coach.id);

  return NextResponse.json({ success: true });
}
