/**
 * Run once in Supabase SQL editor:
 *
 *   CREATE TABLE IF NOT EXISTS athlete_positions (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     athlete_clerk_id text        NOT NULL UNIQUE,
 *     primary_position text        NOT NULL,
 *     secondary_position text,
 *     updated_at       timestamptz DEFAULT now()
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS metric_sessions (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     athlete_clerk_id text        NOT NULL,
 *     coach_clerk_id   text,
 *     session_date     date        NOT NULL,
 *     verification_type text       NOT NULL,
 *     status           text        DEFAULT 'pending',
 *     notes            text,
 *     document_url     text,
 *     created_at       timestamptz DEFAULT now()
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS athlete_metrics (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     athlete_clerk_id text        NOT NULL,
 *     metric_key       text        NOT NULL,
 *     value            numeric     NOT NULL,
 *     unit             text        NOT NULL,
 *     verification_type text       NOT NULL,
 *     source_label     text,
 *     ai_confidence    numeric,
 *     is_personal_best boolean     DEFAULT false,
 *     video_url        text,
 *     session_id       uuid        REFERENCES metric_sessions(id),
 *     recorded_at      timestamptz DEFAULT now(),
 *     created_at       timestamptz DEFAULT now()
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS highlight_videos (
 *     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     athlete_clerk_id text        NOT NULL,
 *     slot_number      int         NOT NULL,
 *     video_url        text        NOT NULL,
 *     title            text,
 *     uploaded_at      timestamptz DEFAULT now(),
 *     UNIQUE(athlete_clerk_id, slot_number)
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { createAdminClient } from '@/lib/supabase';

// /api/* is excluded from clerkMiddleware so auth() has no context here.
// authenticateRequest() reads the session cookie directly for all methods.
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
  } catch (err) {
    console.error('[metrics] authenticateRequest error:', err);
    return null;
  }
}
import {
  METRIC_INFO,
  METRIC_KEYS,
  VERIFICATION_TYPES,
  type AthleteMetric,
  type AthletePosition,
  type MetricKey,
  type VerificationType,
} from '@/lib/metrics';

// ─── GET /api/metrics ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId') ?? userId;
  const metricKey = searchParams.get('metricKey') as MetricKey | null;

  const db = createAdminClient();

  // Build metrics query, optionally filtering by metricKey
  let metricsQuery = db
    .from('athlete_metrics')
    .select('*')
    .eq('athlete_clerk_id', athleteId)
    .order('recorded_at', { ascending: false });

  if (metricKey && METRIC_KEYS.includes(metricKey)) {
    metricsQuery = metricsQuery.eq('metric_key', metricKey);
  }

  const [metricsResult, positionResult] = await Promise.all([
    metricsQuery,
    db
      .from('athlete_positions')
      .select('*')
      .eq('athlete_clerk_id', athleteId)
      .maybeSingle(),
  ]);

  if (metricsResult.error) {
    console.error('[GET /api/metrics] metrics fetch error:', metricsResult.error.message);
    return NextResponse.json({ error: 'Failed to fetch metrics.' }, { status: 500 });
  }

  if (positionResult.error) {
    console.error('[GET /api/metrics] position fetch error:', positionResult.error.message);
    return NextResponse.json({ error: 'Failed to fetch position.' }, { status: 500 });
  }

  return NextResponse.json({
    metrics: (metricsResult.data ?? []) as AthleteMetric[],
    position: (positionResult.data ?? null) as AthletePosition | null,
  });
}

// ─── POST /api/metrics ────────────────────────────────────────────────────────

interface PostBody {
  metric_key: MetricKey;
  value: number;
  verification_type: VerificationType;
  source_label?: string | null;
  ai_confidence?: number | null;
  session_id?: string | null;
  recorded_at?: string | null;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { metric_key, value, verification_type, source_label, ai_confidence, session_id, recorded_at } = body;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!metric_key || !METRIC_KEYS.includes(metric_key)) {
    return NextResponse.json({ error: 'Invalid or missing metric_key.' }, { status: 400 });
  }

  if (value == null || typeof value !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid value.' }, { status: 400 });
  }

  if (!verification_type || !VERIFICATION_TYPES.includes(verification_type)) {
    return NextResponse.json({ error: 'Invalid or missing verification_type.' }, { status: 400 });
  }

  // ── AI confidence gate for third-party sources ────────────────────────────
  const requiresAiConfidence =
    verification_type !== 'self_reported' && verification_type !== 'coach_verified';

  if (requiresAiConfidence && (ai_confidence == null || ai_confidence < 80)) {
    return NextResponse.json(
      { verified: false, reason: 'AI confidence below 80%' },
      { status: 422 },
    );
  }

  // ── Derive unit from metric definition ────────────────────────────────────
  const unit = METRIC_INFO[metric_key].unit;
  const lowerIsBetter = METRIC_INFO[metric_key].lowerIsBetter;

  const db = createAdminClient();

  // ── Check existing personal best for this athlete + metric ─────────────────
  const { data: existingBest, error: bestError } = await db
    .from('athlete_metrics')
    .select('id, value')
    .eq('athlete_clerk_id', userId)
    .eq('metric_key', metric_key)
    .eq('is_personal_best', true)
    .maybeSingle();

  if (bestError) {
    console.error('[POST /api/metrics] personal best fetch error:', bestError.message);
    return NextResponse.json({ error: 'Failed to check personal best.' }, { status: 500 });
  }

  let isPersonalBest = false;

  if (!existingBest) {
    // No existing best — this is the first entry
    isPersonalBest = true;
  } else {
    const existingValue = Number(existingBest.value);
    isPersonalBest = lowerIsBetter
      ? value < existingValue
      : value > existingValue;
  }

  // ── Insert new metric row ─────────────────────────────────────────────────
  const insertPayload = {
    athlete_clerk_id: userId,
    metric_key,
    value,
    unit,
    verification_type,
    source_label:     source_label    ?? null,
    ai_confidence:    ai_confidence   ?? null,
    is_personal_best: isPersonalBest,
    session_id:       session_id      ?? null,
    recorded_at:      recorded_at     ?? new Date().toISOString(),
  };

  const { data: newRow, error: insertError } = await db
    .from('athlete_metrics')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError || !newRow) {
    console.error('[POST /api/metrics] insert error:', insertError?.message);
    return NextResponse.json({ error: 'Failed to save metric.' }, { status: 500 });
  }

  // ── Clear previous personal best rows if this one is now the best ─────────
  if (isPersonalBest && existingBest) {
    const { error: clearError } = await db
      .from('athlete_metrics')
      .update({ is_personal_best: false })
      .eq('athlete_clerk_id', userId)
      .eq('metric_key', metric_key)
      .neq('id', newRow.id);

    if (clearError) {
      console.error('[POST /api/metrics] clear old personal best error:', clearError.message);
      // Non-fatal — the new row is already inserted
    }
  }

  return NextResponse.json({
    success: true,
    isPersonalBest,
    metric: newRow as AthleteMetric,
  });
}

// ─── PATCH /api/metrics ───────────────────────────────────────────────────────
// Updates the value on the athlete's existing personal-best row for a metric.
// Used after video upload when no prior PB existed and a placeholder (value=0)
// was created — the athlete enters their real value in the second step.

interface PatchBody {
  metric_key: MetricKey;
  value: number;
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { metric_key, value } = body;

  if (!metric_key || !METRIC_KEYS.includes(metric_key)) {
    return NextResponse.json({ error: 'Invalid metric_key.' }, { status: 400 });
  }
  if (value == null || typeof value !== 'number' || value <= 0) {
    return NextResponse.json({ error: 'Value must be a positive number.' }, { status: 400 });
  }

  console.log('[PATCH /api/metrics] updating:', { athleteId: userId, metricKey: metric_key, value });

  const db = createAdminClient();
  const { error } = await db
    .from('athlete_metrics')
    .update({ value })
    .eq('athlete_clerk_id', userId)
    .eq('metric_key', metric_key)
    .eq('is_personal_best', true);

  if (error) {
    console.error('[PATCH /api/metrics] update error:', error.message);
    return NextResponse.json({ error: 'Failed to update metric value.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, value });
}
