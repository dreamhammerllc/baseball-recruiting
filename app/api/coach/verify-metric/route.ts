import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_KEYS, METRIC_INFO, type MetricKey } from '@/lib/metrics';
import { computeVerificationTier } from '@/lib/verificationTier';
import { isWithinCorroborationTolerance } from '@/lib/corroborationTolerance';

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
  readoutUrl?: string | null;
  extractionId?: string | null;
  recordedAt?: string | null;
}

// A no-device claim more than this fraction above the athlete's established
// (highest) verified value for the same metric is flagged for review.
// Tunable — keep small enough to catch suspicious jumps while still allowing
// real-world improvement (~10% over an existing best).
const HISTORY_JUMP_THRESHOLD = 0.10;

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

  const { athleteClerkId, metricKey, value, videoUrl, readoutUrl, extractionId, recordedAt } = body;

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

  // ── Athlete profile snapshot (for evidence-bundle context) ────────────────
  // Read-only context fields used to ground the evidence bundle. If the athlete
  // row is missing or the read errors, the snapshot is treated as null — this
  // never blocks the verification flow.
  const { data: athleteSnapshot } = await db
    .from('athletes')
    .select('grad_year, position, secondary_position, height_inches, weight_lbs, throws, bats, home_state')
    .eq('clerk_user_id', athleteClerkId)
    .maybeSingle();

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

  // ── Decision: device reading (when present) overrides AI plausibility ────
  //
  // Trust ordering:
  //   1. If the server has a readout_extractions row for this submission
  //      (looked up by extractionId, scoped to this coach + this metric),
  //      the device reading drives approve/flag through a tolerance check
  //      against the coach's typed value. The AI plausibility model is NOT
  //      called — the device IS the verification.
  //   2. Otherwise, fall back to the existing Claude plausibility flow.
  //      This is byte-for-byte the behavior shipped before 2b-i (fail-closed
  //      on missing key / parse error, >=70 confidence threshold).
  //
  // aiStatus / aiConfidence / aiNotes are filled in by whichever branch runs
  // so the response shape and the metric_sessions bundle stay uniform.
  const info = METRIC_INFO[metricKey];
  // Widened to allow null — the history-aware branches in the no-device
  // fallback set aiConfidence = null (the call signature of the AI model is
  // intentionally not re-used to ground a numeric confidence). Both the
  // metric_sessions.ai_confidence and athlete_metrics.ai_confidence columns
  // are nullable, and the response forwards the value as-is.
  let aiConfidence: number | null = 0;
  let aiNotes = '';
  let aiStatus: 'approved' | 'flagged';
  // Used only in the AI-plausibility fallback to label decision_reason.
  let aiFailClosedReason: string | null = null;
  let decisionReason     = '';
  let deviceCorroborated = false;

  // ── Server-authoritative ledger lookup ────────────────────────────────────
  //
  // The extracted value lives in readout_extractions, written by the upload
  // route. The decision reads it back BY ID here — verify-metric never trusts
  // a value the client put in the request body.
  let ledgerValue:      number | null = null;
  let ledgerConfidence: number | null = null;
  let ledgerReadoutUrl: string | null = null;

  if (typeof extractionId === 'string' && extractionId.length > 0) {
    try {
      const { data: ledgerRow } = await db
        .from('readout_extractions')
        .select('extracted_value, confidence, readout_url')
        .eq('id', extractionId)
        .eq('coach_clerk_id', userId)
        .eq('metric_key', metricKey)
        .maybeSingle();

      if (ledgerRow) {
        ledgerValue =
          ledgerRow.extracted_value != null
            ? Number(ledgerRow.extracted_value)
            : null;
        ledgerConfidence =
          ledgerRow.confidence != null ? Number(ledgerRow.confidence) : null;
        ledgerReadoutUrl = ledgerRow.readout_url ?? null;

        // Best-effort audit stamp. We do NOT filter on consumed_at being
        // null — re-consumes are allowed and simply re-stamp.
        try {
          await db
            .from('readout_extractions')
            .update({ consumed_at: new Date().toISOString() })
            .eq('id', extractionId);
        } catch (stampErr) {
          console.error('[verify-metric] readout_extractions consumed_at stamp skipped:', stampErr);
        }
      }
    } catch (err) {
      console.error('[verify-metric] readout_extractions lookup failed:', err);
      // ledgerValue stays null — flow falls through to the AI branch.
    }
  }

  if (ledgerValue !== null) {
    // ── Device branch — server-extracted reading is the source of truth ────
    deviceCorroborated = isWithinCorroborationTolerance(info.unit, value, ledgerValue);
    aiStatus       = deviceCorroborated ? 'approved' : 'flagged';
    aiConfidence   = ledgerConfidence ?? 0;
    aiNotes        = `Device reading ${ledgerValue} ${info.unit} ${
      deviceCorroborated ? 'corroborates' : 'differs from'
    } the entered ${value} ${info.unit}.`;
    decisionReason = deviceCorroborated ? 'device_corroborated' : 'device_divergence';
  } else {
    // ── No device reading — smart jump-check against the athlete's history ──
    //
    // Phase 2b-ii: replaces the flat 70-confidence threshold as the PRIMARY
    // path for no-device submissions. Look up the athlete's established
    // (highest) verified value for this metric. If a history exists, decide
    // approve/flag by whether the coach's claim is in-line with it. The AI
    // plausibility model is preserved as the FALLBACK only when the athlete
    // has no verified history for this metric yet (first-ever measurement).
    let established: number | null = null;
    try {
      const { data: bestRow } = await db
        .from('athlete_metrics')
        .select('value')
        .eq('athlete_clerk_id', athleteClerkId)
        .eq('metric_key', metricKey)
        .order('value', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bestRow && bestRow.value != null) {
        established = Number(bestRow.value);
      }
    } catch (err) {
      console.error('[verify-metric] established-value lookup failed:', err);
      // established stays null — flow falls through to the AI fallback.
    }

    if (established !== null) {
      // ── History-aware branch — compare against the athlete's verified best ──
      //
      // Timing metrics (unit "s" — sixty_yard_dash, home_to_first, pop_time)
      // are lower-is-better: a suspiciously FAST time is the jump to flag,
      // not a slow one. Everything else is higher-is-better (mph velocities,
      // rpm spin, ft distances, deg angles, etc.).
      const lowerIsBetter = info.unit.trim().toLowerCase() === 's';
      const isLargeJump = lowerIsBetter
        ? value < established * (1 - HISTORY_JUMP_THRESHOLD)   // suspiciously fast time
        : value > established * (1 + HISTORY_JUMP_THRESHOLD);  // suspiciously high value
      aiStatus       = isLargeJump ? 'flagged' : 'approved';
      aiConfidence   = null;
      aiNotes        = isLargeJump
        ? `Claimed ${value} ${info.unit} is a large jump from the athlete's established ${established} ${info.unit}.`
        : `Claimed ${value} ${info.unit} is consistent with the athlete's established ${established} ${info.unit}.`;
      decisionReason = isLargeJump ? 'history_jump' : 'history_consistent';
    } else {
      // ── Fallback: Claude AI plausibility review (first-ever measurement) ────
      //
      // Fail-closed policy:
      //   - AI call throws / returns unparseable JSON  → flagged (every environment)
      //   - AI key missing in production               → flagged
      //   - AI key missing in development              → approved as a dev convenience,
      //                                                  with notes marking it
      //   - AI returns confidence                      → status = confidence >= 70
      //
      // Never auto-approve in production without a real review.
      const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.APP_AI_KEY;
      if (!apiKey) {
        if (process.env.NODE_ENV === 'development') {
          aiStatus = 'approved';
          aiNotes  = 'DEV: AI review skipped (no key).';
          aiFailClosedReason = 'AI review skipped (no key, dev environment).';
        } else {
          aiStatus = 'flagged';
          aiNotes  = 'AI review unavailable.';
          aiFailClosedReason = 'AI review unavailable.';
        }
      } else {
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

          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('No JSON object found in Claude response.');
          }

          const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
            plausible: boolean;
            confidence: number;
            notes: string;
          };
          aiNotes = parsed.notes ?? '';
          aiConfidence = parsed.plausible
            ? (parsed.confidence ?? 80)
            : Math.min(parsed.confidence ?? 40, 50);
          aiStatus = aiConfidence >= 70 ? 'approved' : 'flagged';
        } catch (err) {
          console.error('[verify-metric] Claude review failed — flagging:', err);
          aiStatus     = 'flagged';
          aiConfidence = 0;
          aiNotes      = 'Automated review failed — not auto-approved.';
          aiFailClosedReason = 'Automated review failed.';
        }
      }

      // Decision-reason derivation stays scoped to this branch.
      decisionReason = aiFailClosedReason
        ? `fail-closed: ${aiFailClosedReason}`
        : (aiStatus === 'approved'
            ? `ai_confidence ${aiConfidence} >= 70`
            : `ai_confidence ${aiConfidence} < 70`);
    }
  }

  const now = new Date().toISOString();
  const recordedAtValue = recordedAt ?? now;

  // Readout value persisted into the evidence bundle. Sourced from the
  // ledger only — never from anything the client supplied.
  const readoutExtractedValue = ledgerValue;

  // Trust tier for this attempt. Coach-submitted in this route.
  const tier = computeVerificationTier({
    submittedBy:        'coach',
    deviceCorroborated,
    hasVideo:           Boolean(videoUrl),
  });

  // ── Evidence-bundle row in metric_sessions (every attempt, approve + flag) ──
  //
  // Fail-safe: if this insert errors or throws, log it and continue with
  // sessionId = null. Evidence capture must NEVER block or alter the
  // verification response.
  const sessionDateValue = recordedAt ? new Date(recordedAt) : new Date();

  let sessionId: string | null = null;
  try {
    const { data: sessionRow, error: sessionInsertError } = await db
      .from('metric_sessions')
      .insert({
        athlete_clerk_id:        athleteClerkId,
        coach_clerk_id:          userId,
        metric_key:              metricKey,
        claimed_value:           value,
        video_url:               videoUrl ?? null,
        readout_file_url:        readoutUrl ?? ledgerReadoutUrl ?? null,
        readout_extracted_value: readoutExtractedValue,
        ai_confidence:           aiConfidence,
        ai_notes:                aiNotes || null,
        status:                  aiStatus,
        decision_reason:         decisionReason,
        session_date:            sessionDateValue,
        verification_type:       'coach_verified',
        athlete_context:         athleteSnapshot ?? null,
        verification_tier:       aiStatus === 'approved' ? tier : null,
      })
      .select('id')
      .single();

    if (sessionInsertError) {
      console.error('[verify-metric] metric_sessions insert error:', sessionInsertError.message);
    } else {
      sessionId = sessionRow?.id ?? null;
    }
  } catch (err) {
    console.error('[verify-metric] metric_sessions insert threw:', err);
  }

  // ── Insert coach_verifications row (always) ───────────────────────────────
  const { error: cvInsertError } = await db.from('coach_verifications').insert({
    coach_id:         coach.id,
    athlete_clerk_id: athleteClerkId,
    metric_key:       metricKey,
    value,
    video_url:        videoUrl ?? null,
    recorded_at:      recordedAtValue,
    ai_reviewed_at:   now,
    approved_at:      aiStatus === 'approved' ? now : null,
    status:           aiStatus,
    session_id:       sessionId,
  });

  if (cvInsertError) {
    console.error('[verify-metric] coach_verifications insert error:', cvInsertError.message);
    return NextResponse.json({ error: 'Failed to record verification.' }, { status: 500 });
  }

  // ── Write to athlete_metrics ONLY when the verification was approved ──────
  //
  // Flagged verifications still get a coach_verifications row above (coach's
  // record of the attempt) but must NOT publish to athlete_metrics — that's
  // the table the public profile + coach Discover read from. We also skip the
  // personal-best demotion step: with no new metric inserted, there's nothing
  // to demote the prior PB in favor of.
  if (aiStatus === 'approved') {
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
        session_id:        sessionId,
        verification_tier: tier,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[verify-metric] athlete_metrics insert error:', insertError.message);
    }

    // ── Roll up athletes.verification_tier to the STRONGEST tier the athlete
    //    now holds. Best-effort: read-modify-write against a NULL-or-≥1
    //    column. Failure logged but never blocks the response. NULL is
    //    treated as 7 (weakest) so any verified tier wins on first publish.
    if (newRow) {
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
          if (rollupError) {
            console.error('[verify-metric] athletes verification_tier rollup error:', rollupError.message);
          }
        }
      } catch (err) {
        console.error('[verify-metric] athletes verification_tier rollup threw:', err);
      }
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
    status:      aiStatus,
    aiConfidence,
    aiNotes,
  });
}
