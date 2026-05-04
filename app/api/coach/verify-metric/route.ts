import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_KEYS, METRIC_INFO, type MetricKey } from '@/lib/metrics';

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
    console.error('[coach/verify-metric] authenticateRequest error:', err);
    return null;
  }
}

interface VerifyBody {
  athleteClerkId: string;
  metricKey: MetricKey;
  value: number;
  videoUrl?: string | null;
  recordedAt?: string | null;
}

// ─── POST /api/coach/verify-metric ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { athleteClerkId, metricKey, value, videoUrl, recordedAt } = body;

  if (!athleteClerkId) {
    return NextResponse.json({ error: 'athleteClerkId is required.' }, { status: 400 });
  }
  if (!metricKey || !METRIC_KEYS.includes(metricKey)) {
    return NextResponse.json({ error: 'Invalid or missing metricKey.' }, { status: 400 });
  }
  if (value == null || typeof value !== 'number' || isNaN(value) || value <= 0) {
    return NextResponse.json({ error: 'Value must be a positive number.' }, { status: 400 });
  }

  const db = createAdminClient();

  // ── Get coach profile ─────────────────────────────────────────────────────
  const { data: coach, error: coachError } = await db
    .from('coaches')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (coachError) {
    console.error('[verify-metric] coach fetch error:', coachError.message);
    return NextResponse.json({ error: 'Failed to load coach profile.' }, { status: 500 });
  }
  if (!coach) {
    return NextResponse.json(
      { error: 'Coach profile not found. Complete your profile setup first.' },
      { status: 404 },
    );
  }

  // ── 72-hour cooldown check ────────────────────────────────────────────────
  const cooldownCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: recentVerification } = await db
    .from('coach_verifications')
    .select('created_at')
    .eq('coach_id', coach.id)
    .eq('athlete_clerk_id', athleteClerkId)
    .eq('metric_key', metricKey)
    .gte('created_at', cooldownCutoff)
    .limit(1)
    .maybeSingle();

  if (recentVerification) {
    const nextAvailableAt = new Date(
      new Date(recentVerification.created_at).getTime() + 72 * 60 * 60 * 1000,
    ).toISOString();
    return NextResponse.json(
      {
        error: 'A verification for this athlete and metric was submitted recently. Please wait 72 hours between verifications.',
        nextAvailableAt,
      },
      { status: 429 },
    );
  }

  // ── Claude AI plausibility review ─────────────────────────────────────────
  const info = METRIC_INFO[metricKey];
  let aiConfidence = 80;
  let aiNotes = '';

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role:    'user',
          content: `Evaluate whether this baseball performance metric is realistic for a competitive high school or college player.\n\nMetric: ${info.label} (${info.unit})\nValue: ${value}\nSubmitted by: ${coach.full_name}, ${coach.title} at ${coach.organization}\n\nRespond ONLY with valid JSON (no markdown, no extra text):\n{"plausible":true,"confidence":85,"notes":"brief reason"}`,
        }],
      });

      const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd   = raw.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
          plausible: boolean;
          confidence: number;
          notes: string;
        };
        aiNotes = parsed.notes ?? '';
        aiConfidence = parsed.plausible
          ? (parsed.confidence ?? 80)
          : Math.min(parsed.confidence ?? 40, 50);
      }
    } catch (err) {
      console.error('[verify-metric] Claude review failed — defaulting to approved:', err);
    }
  }

  const isApproved = aiConfidence >= 70;
  const now = new Date().toISOString();
  const recordedAtValue = recordedAt ?? now;

  // ── Insert coach_verifications row ────────────────────────────────────────
  const { error: cvInsertError } = await db.from('coach_verifications').insert({
    coach_id:        coach.id,
    athlete_clerk_id: athleteClerkId,
    metric_key:      metricKey,
    value,
    video_url:       videoUrl    ?? null,
    recorded_at:     recordedAtValue,
    ai_reviewed_at:  now,
    approved_at:     isApproved ? now : null,
    status:          isApproved ? 'approved' : 'pending',
  });

  if (cvInsertError) {
    console.error('[verify-metric] coach_verifications insert error:', cvInsertError.message);
    return NextResponse.json({ error: 'Failed to record verification.' }, { status: 500 });
  }

  // ── If approved: personal best logic + insert athlete_metrics ─────────────
  if (isApproved) {
    const { data: existingBest } = await db
      .from('athlete_metrics')
      .select('id, value')
      .eq('athlete_clerk_id', athleteClerkId)
      .eq('metric_key', metricKey)
      .eq('is_personal_best', true)
      .maybeSingle();

    const lowerIsBetter = info.lowerIsBetter;
    const isPersonalBest = !existingBest ||
      (lowerIsBetter
        ? value < Number(existingBest.value)
        : value > Number(existingBest.value));

    const { data: newRow, error: insertError } = await db
      .from('athlete_metrics')
      .insert({
        athlete_clerk_id:  athleteClerkId,
        metric_key:        metricKey,
        value,
        unit:              info.unit,
        verification_type: 'coach_verified',
        source_label:      `${coach.full_name} - ${coach.organization}`,
        ai_confidence:     aiConfidence,
        is_personal_best:  isPersonalBest,
        video_url:         isPersonalBest ? (videoUrl ?? null) : null,
        recorded_at:       recordedAtValue,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[verify-metric] athlete_metrics insert error:', insertError.message);
    }

    if (isPersonalBest && existingBest && newRow) {
      const { error: clearError } = await db
        .from('athlete_metrics')
        .update({ is_personal_best: false })
        .eq('athlete_clerk_id', athleteClerkId)
        .eq('metric_key', metricKey)
        .neq('id', newRow.id);

      if (clearError) {
        console.error('[verify-metric] clear old PB error:', clearError.message);
      }
    }
  }

  return NextResponse.json({
    success:     true,
    status:      isApproved ? 'approved' : 'pending',
    aiConfidence,
    aiNotes,
  });
}
