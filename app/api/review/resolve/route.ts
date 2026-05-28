import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_INFO } from '@/lib/metrics';
import { computeVerificationTier } from '@/lib/verificationTier';
import { isReviewer } from '@/lib/reviewer';
import { getAuthenticatedUserId } from '@/lib/auth';
import { writeThroughCoachVerified } from '@/lib/writeThroughCoachVerified';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await isReviewer(userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { sessionId?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
  const action = body.action === 'approve' || body.action === 'reject' ? body.action : null;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (!sessionId || !action) {
    return NextResponse.json({ error: 'sessionId and action ("approve"|"reject") are required' }, { status: 400 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data: session, error: loadError } = await db
    .from('metric_sessions')
    .select('id, athlete_clerk_id, coach_clerk_id, metric_key, claimed_value, video_url, ai_confidence, session_date, created_at, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (loadError) {
    console.error('[review/resolve] load error:', loadError.message);
    return NextResponse.json({ error: 'Failed to load review item.' }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: 'Review item not found.' }, { status: 404 });
  if (session.status !== 'flagged') {
    return NextResponse.json({ error: `This item is not awaiting review (status: ${session.status}).` }, { status: 409 });
  }

  // ── REJECT ──────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error: msErr } = await db
      .from('metric_sessions')
      .update({ status: 'rejected', reviewed_at: now, reviewed_by: userId, review_note: note })
      .eq('id', sessionId);
    if (msErr) {
      console.error('[review/resolve] reject metric_sessions update error:', msErr.message);
      return NextResponse.json({ error: 'Failed to reject.' }, { status: 500 });
    }
    const { error: cvErr } = await db
      .from('coach_verifications')
      .update({ status: 'rejected' })
      .eq('session_id', sessionId);
    if (cvErr) console.error('[review/resolve] reject coach_verifications update error:', cvErr.message);
    return NextResponse.json({ ok: true, action: 'rejected' });
  }

  // ── APPROVE (publish) ────────────────────────────────────────────────────
  const athleteClerkId = session.athlete_clerk_id as string;
  const metricKey = session.metric_key as string;
  const value = Number(session.claimed_value);
  const videoUrl = (session.video_url as string | null) ?? null;

  const info = METRIC_INFO[metricKey];
  if (!info || !Number.isFinite(value)) {
    return NextResponse.json({ error: 'Invalid metric data on this item.' }, { status: 400 });
  }

  // Reviewer approval is human judgment, never device corroboration → tier 5 (video) or 6 (no video).
  const tier = computeVerificationTier({ submittedBy: 'coach', deviceCorroborated: false, hasVideo: Boolean(videoUrl) });

  let sourceLabel = 'Coach verified (reviewer-approved)';
  const { data: coach } = await db
    .from('coaches')
    .select('full_name, organization')
    .eq('clerk_user_id', session.coach_clerk_id)
    .maybeSingle();
  if (coach?.full_name) {
    sourceLabel = coach.organization ? `${coach.full_name} - ${coach.organization}` : coach.full_name;
  }

  const recordedAtValue = (session.session_date as string | null) ?? (session.created_at as string | null) ?? now;

  const { data: existingBest } = await db
    .from('athlete_metrics')
    .select('id, value')
    .eq('athlete_clerk_id', athleteClerkId)
    .eq('metric_key', metricKey)
    .eq('is_personal_best', true)
    .maybeSingle();

  const lowerIsBetter = info.lowerIsBetter;
  const isPersonalBest = !existingBest ||
    (lowerIsBetter ? value < Number(existingBest.value) : value > Number(existingBest.value));

  const { data: newRow, error: insertError } = await db
    .from('athlete_metrics')
    .insert({
      athlete_clerk_id:  athleteClerkId,
      metric_key:        metricKey,
      value,
      unit:              info.unit,
      verification_type: 'coach_verified',
      source_label:      sourceLabel,
      ai_confidence:     (session.ai_confidence as number | null) ?? null,
      is_personal_best:  isPersonalBest,
      video_url:         isPersonalBest ? (videoUrl ?? null) : null,
      recorded_at:       recordedAtValue,
      session_id:        sessionId,
      verification_tier: tier,
    })
    .select('id')
    .single();

  if (insertError || !newRow) {
    console.error('[review/resolve] athlete_metrics insert error:', insertError?.message);
    return NextResponse.json({ error: 'Failed to publish metric.' }, { status: 500 });
  }

  try {
    const { data: athleteRow } = await db
      .from('athletes')
      .select('verification_tier')
      .eq('clerk_user_id', athleteClerkId)
      .maybeSingle();
    const existingTier = (athleteRow?.verification_tier as number | null) ?? null;
    const effectiveExisting = existingTier ?? 7;
    const strongest = Math.min(effectiveExisting, tier);
    if (strongest !== existingTier) {
      const { error: rollupError } = await db
        .from('athletes')
        .update({ verification_tier: strongest })
        .eq('clerk_user_id', athleteClerkId);
      if (rollupError) console.error('[review/resolve] athletes rollup error:', rollupError.message);
    }
  } catch (err) {
    console.error('[review/resolve] athletes rollup threw:', err);
  }

  if (isPersonalBest && existingBest) {
    const { error: clearError } = await db
      .from('athlete_metrics')
      .update({ is_personal_best: false })
      .eq('athlete_clerk_id', athleteClerkId)
      .eq('metric_key', metricKey)
      .neq('id', newRow.id);
    if (clearError) console.error('[review/resolve] clear old PB error:', clearError.message);
  }

  const { error: msErr } = await db
    .from('metric_sessions')
    .update({ status: 'approved', verification_tier: tier, reviewed_at: now, reviewed_by: userId, review_note: note })
    .eq('id', sessionId);
  if (msErr) console.error('[review/resolve] approve metric_sessions update error:', msErr.message);

  const { error: cvErr } = await db
    .from('coach_verifications')
    .update({ status: 'approved', approved_at: now })
    .eq('session_id', sessionId);
  if (cvErr) console.error('[review/resolve] approve coach_verifications update error:', cvErr.message);

  // ── Write-through: propagate the coach-verified PB to denormalized stores
  //    (athletes.*_mph/_seconds and athlete_pitches.velocity). No-op for
  //    metric_keys that have no denormalized destination. Fail-safe: the
  //    helper never throws.
  try {
    await writeThroughCoachVerified(db, athleteClerkId, metricKey);
  } catch (err) {
    console.error('[review/resolve] write-through failed:', err);
  }

  return NextResponse.json({ ok: true, action: 'approved', tier });
}
