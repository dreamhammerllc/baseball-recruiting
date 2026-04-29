import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';
import { Resend } from 'resend';

const clerk = createClerkClient({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

// POST /api/bookings — create a new booking
export async function POST(req: NextRequest) {
  const athleteClerkId = await getAuthenticatedUserId(req);
  if (!athleteClerkId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await req.json() as {
    coach_id: string;
    scheduled_at: string;
    metric_keys?: string[];
    athlete_notes?: string;
  };

  if (!body.coach_id || !body.scheduled_at) {
    return NextResponse.json({ error: 'coach_id and scheduled_at are required.' }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify coach exists and is accepting bookings
  const { data: coach } = await db
    .from('coaches')
    .select('id, full_name, email, session_duration_minutes')
    .eq('id', body.coach_id)
    .eq('is_accepting_bookings', true)
    .maybeSingle();

  if (!coach) return NextResponse.json({ error: 'Coach not found or not accepting bookings.' }, { status: 404 });

  // Double-booking check
  const { data: conflict } = await db
    .from('bookings')
    .select('id')
    .eq('coach_id', body.coach_id)
    .eq('scheduled_at', body.scheduled_at)
    .eq('status', 'confirmed')
    .maybeSingle();

  if (conflict) return NextResponse.json({ error: 'That time slot is no longer available.' }, { status: 409 });

  // Get athlete info for notification emails
  const { data: athlete } = await db
    .from('athletes')
    .select('full_name, email: email')
    .eq('clerk_user_id', athleteClerkId)
    .maybeSingle();

  // Create the booking
  const { data: booking, error } = await db
    .from('bookings')
    .insert({
      coach_id:         body.coach_id,
      athlete_clerk_id: athleteClerkId,
      scheduled_at:     body.scheduled_at,
      duration_minutes: coach.session_duration_minutes ?? 60,
      metric_keys:      body.metric_keys ?? [],
      athlete_notes:    body.athlete_notes ?? null,
      status:           'confirmed',
    })
    .select()
    .single();

  if (error || !booking) {
    console.error('[bookings] insert error:', error?.message);
    return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
  }

  const dateStr = formatDateTime(body.scheduled_at);
  const athleteName = (athlete as { full_name?: string } | null)?.full_name ?? 'An athlete';
  const athleteEmail = (db as unknown as Record<string, unknown>); // only used for reference
  void athleteEmail;

  // Send email to coach
  try {
    await resend.emails.send({
      from: 'Diamond Verified <notifications@diamondverified.app>',
      to: coach.email,
      subject: `New testing session booked — ${dateStr}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0d1117;color:#f0f6fc;border-radius:12px;">
          <h2 style="color:#e8a020;margin:0 0 16px;">◆ New Booking</h2>
          <p style="color:#9ca3af;margin:0 0 8px;">You have a new testing session request.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Athlete</td><td style="color:#f0f6fc;font-size:14px;">${athleteName}</td></tr>
            <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Date & Time</td><td style="color:#f0f6fc;font-size:14px;">${dateStr}</td></tr>
            <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Metrics</td><td style="color:#f0f6fc;font-size:14px;">${(body.metric_keys ?? []).join(', ') || 'Not specified'}</td></tr>
            ${body.athlete_notes ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Notes</td><td style="color:#f0f6fc;font-size:14px;">${body.athlete_notes}</td></tr>` : ''}
          </table>
          <a href="https://diamondverified.app/dashboard/coach" style="display:inline-block;background:#e8a020;color:#000;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">View in Dashboard</a>
        </div>
      `,
    });
  } catch (e) { console.error('[bookings] coach email error:', e); }

  // Send confirmation to athlete (using Clerk email)
  try {
    const clerkUser = await clerk.users.getUser(athleteClerkId);
    const athleteEmailAddr = clerkUser.emailAddresses[0]?.emailAddress;
    if (athleteEmailAddr) {
      await resend.emails.send({
        from: 'Diamond Verified <notifications@diamondverified.app>',
        to: athleteEmailAddr,
        subject: `Your testing session is confirmed — ${dateStr}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0d1117;color:#f0f6fc;border-radius:12px;">
            <h2 style="color:#e8a020;margin:0 0 16px;">◆ Session Confirmed</h2>
            <p style="color:#9ca3af;margin:0 0 8px;">Your testing session with <strong style="color:#f0f6fc;">${coach.full_name}</strong> is confirmed.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Coach</td><td style="color:#f0f6fc;font-size:14px;">${coach.full_name}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Date & Time</td><td style="color:#f0f6fc;font-size:14px;">${dateStr}</td></tr>
              <tr><td style="color:#6b7280;padding:6px 0;font-size:14px;">Duration</td><td style="color:#f0f6fc;font-size:14px;">${coach.session_duration_minutes ?? 60} minutes</td></tr>
            </table>
            <a href="https://diamondverified.app/dashboard/athlete" style="display:inline-block;background:#e8a020;color:#000;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">View My Dashboard</a>
          </div>
        `,
      });
    }
  } catch (e) { console.error('[bookings] athlete email error:', e); }

  return NextResponse.json({ booking }, { status: 201 });
}

// GET /api/bookings — fetch bookings for the current user
export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const db = createAdminClient();

  // Check if user is a coach
  const { data: coach } = await db
    .from('coaches')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  let bookings;
  if (coach) {
    const { data } = await db
      .from('bookings')
      .select('*')
      .eq('coach_id', coach.id)
      .order('scheduled_at');
    bookings = data;
  } else {
    const { data } = await db
      .from('bookings')
      .select('*, coach:coaches(full_name, email, title, organization, photo_url)')
      .eq('athlete_clerk_id', userId)
      .order('scheduled_at');
    bookings = data;
  }

  return NextResponse.json({ bookings: bookings ?? [] });
}
