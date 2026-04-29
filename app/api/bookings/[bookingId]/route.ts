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

// PATCH /api/bookings/[bookingId] — update status (cancel)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { bookingId } = await params;
  const { status } = await req.json() as { status: string };

  if (!['cancelled', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch booking to verify ownership
  const { data: booking } = await db
    .from('bookings')
    .select('id, athlete_clerk_id, coach_id, scheduled_at')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

  // Check ownership — must be the athlete or the coach
  const { data: coach } = await db.from('coaches').select('id').eq('clerk_user_id', userId).maybeSingle();
  const isCoach   = coach && coach.id === booking.coach_id;
  const isAthlete = booking.athlete_clerk_id === userId;

  if (!isCoach && !isAthlete) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
  }

  const { error } = await db
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) return NextResponse.json({ error: 'Failed to update booking.' }, { status: 500 });

  return NextResponse.json({ success: true });
}
