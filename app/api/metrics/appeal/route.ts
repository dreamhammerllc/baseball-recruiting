import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const db = createAdminClient();

  const { data: session, error: loadError } = await db
    .from('metric_sessions')
    .select('id, athlete_clerk_id, coach_clerk_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (loadError) {
    console.error('[metrics/appeal] load error:', loadError.message);
    return NextResponse.json({ error: 'Failed to load metric.' }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: 'Metric not found.' }, { status: 404 });

  if (userId !== session.athlete_clerk_id && userId !== session.coach_clerk_id) {
    return NextResponse.json({ error: 'Not authorized to appeal this metric.' }, { status: 403 });
  }

  if (session.status !== 'flagged' && session.status !== 'rejected') {
    return NextResponse.json({ error: `This metric can't be sent to review (status: ${session.status}).` }, { status: 409 });
  }

  const now = new Date().toISOString();

  const { error: msErr } = await db
    .from('metric_sessions')
    .update({ status: 'flagged', review_requested: true, review_requested_at: now, review_requested_by: userId })
    .eq('id', sessionId);
  if (msErr) {
    console.error('[metrics/appeal] metric_sessions update error:', msErr.message);
    return NextResponse.json({ error: 'Failed to file appeal.' }, { status: 500 });
  }

  const { error: cvErr } = await db
    .from('coach_verifications')
    .update({ status: 'flagged' })
    .eq('session_id', sessionId);
  if (cvErr) console.error('[metrics/appeal] coach_verifications update error:', cvErr.message);

  return NextResponse.json({ ok: true, status: 'flagged', reviewRequested: true });
}
