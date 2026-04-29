import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// GET /api/coaches/[coachId]/slots?date=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ coachId: string }> }
) {
  const { coachId } = await params;
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date'); // "YYYY-MM-DD"

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Date parameter required (YYYY-MM-DD).' }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch coach settings
  const { data: coach } = await db
    .from('coaches')
    .select('id, advance_notice_hours, session_duration_minutes, is_accepting_bookings')
    .eq('id', coachId)
    .maybeSingle();

  if (!coach || !coach.is_accepting_bookings) {
    return NextResponse.json({ slots: [] });
  }

  const durationMin = coach.session_duration_minutes ?? 60;
  const advanceHrs  = coach.advance_notice_hours     ?? 24;

  // Day of week for the requested date (0=Sun … 6=Sat)
  const targetDate = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek  = targetDate.getDay();

  // Fetch availability windows for that day
  const { data: windows } = await db
    .from('coach_availability')
    .select('start_time, end_time')
    .eq('coach_id', coach.id)
    .eq('day_of_week', dayOfWeek);

  if (!windows?.length) return NextResponse.json({ slots: [] });

  // Fetch existing bookings for that date to avoid double-booking
  const dayStart = `${dateStr}T00:00:00+00:00`;
  const dayEnd   = `${dateStr}T23:59:59+00:00`;

  const { data: existingBookings } = await db
    .from('bookings')
    .select('scheduled_at, duration_minutes')
    .eq('coach_id', coachId)
    .eq('status', 'confirmed')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd);

  // Build set of booked start-minute offsets from midnight
  const bookedMinutes = new Set<number>(
    (existingBookings ?? []).map(b => {
      const d = new Date(b.scheduled_at);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    })
  );

  // Generate slots from each availability window
  const slots: string[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + advanceHrs * 60 * 60 * 1000);

  for (const win of windows) {
    const [sh, sm] = win.start_time.split(':').map(Number);
    const [eh, em] = win.end_time.split(':').map(Number);
    let cursor = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cursor + durationMin <= endMin) {
      if (!bookedMinutes.has(cursor)) {
        // Build ISO string for this slot
        const slotHour = Math.floor(cursor / 60);
        const slotMin  = cursor % 60;
        const slotISO  = `${dateStr}T${String(slotHour).padStart(2,'0')}:${String(slotMin).padStart(2,'0')}:00`;
        const slotDate = new Date(slotISO);

        // Exclude slots that are within the advance notice window
        if (slotDate > cutoff) {
          slots.push(slotISO);
        }
      }
      cursor += durationMin;
    }
  }

  return NextResponse.json({ slots, duration_minutes: durationMin });
}
