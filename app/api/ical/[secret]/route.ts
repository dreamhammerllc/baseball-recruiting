import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// GET /api/ical/[secret]
// Returns a valid .ics calendar feed containing all confirmed bookings for the coach
// whose ical_secret matches the URL param. The secret acts as auth — no login required.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  if (!secret) return new NextResponse('Not found', { status: 404 });

  const db = createAdminClient();

  // Look up the coach by ical_secret
  const { data: coach } = await db
    .from('coaches')
    .select('id, full_name, email')
    .eq('ical_secret', secret)
    .maybeSingle();

  if (!coach) return new NextResponse('Not found', { status: 404 });

  // Fetch all confirmed bookings for this coach
  const { data: bookings } = await db
    .from('bookings')
    .select('id, scheduled_at, duration_minutes, athlete_clerk_id, metric_keys, athlete_notes')
    .eq('coach_id', coach.id)
    .eq('status', 'confirmed')
    .order('scheduled_at');

  // Build iCal VEVENT entries
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const domainProdId = '-//Diamond Verified//Baseball Recruiting//EN';

  const events = (bookings ?? []).map(b => {
    const start = new Date(b.scheduled_at);
    const end   = new Date(start.getTime() + (b.duration_minutes ?? 60) * 60 * 1000);

    const formatDt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const uid = `booking-${b.id}@diamondverified.app`;
    const summary = `Diamond Verified Testing Session`;
    const metrics = (b.metric_keys ?? []).join(', ');
    const description = [
      `Athlete ID: ${b.athlete_clerk_id}`,
      metrics ? `Metrics: ${metrics}` : '',
      b.athlete_notes ? `Notes: ${b.athlete_notes}` : '',
    ].filter(Boolean).join('\\n');

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDt(start)}`,
      `DTEND:${formatDt(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER:CN=${coach.full_name}:mailto:${coach.email}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n');
  });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${domainProdId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Diamond Verified — ${coach.full_name}`,
    'X-WR-TIMEZONE:UTC',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="diamond-verified-${coach.id}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
