import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { METRIC_KEYS, METRIC_INFO, type MetricKey } from '@/lib/metrics';
import { extractReadoutValue } from '@/lib/visionExtract';

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
  recordedAt?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fallback when a Supabase Storage public URL's HEAD/GET doesn't carry a usable
// Content-Type header — infer from the path extension. Only the MIME types the
// upload route accepts (PDF + the six image variants) are mapped; everything
// else returns null so the extractor's unsupported-type branch fires.
function inferMimeFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.slice(pathname.lastIndexOf('.'));
    switch (ext) {
      case '.pdf':  return 'application/pdf';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.png':  return 'image/png';
      case '.gif':  return 'image/gif';
      case '.webp': return 'image/webp';
      case '.heic': return 'image/heic';
      case '.heif': return 'image/heif';
      default:      return null;
    }
  } catch {
    return null;
  }
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

  const { athleteClerkId, metricKey, value, videoUrl, readoutUrl, recordedAt } = body;

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

  // ── Claude AI plausibility review ─────────────────────────────────────────
  //
  // Fail-closed policy:
  //   - AI call throws / returns unparseable JSON  → flagged (every environment)
  //   - AI key missing in production               → flagged
  //   - AI key missing in development              → approved as a dev convenience,
  //                                                  with notes marking it
  //   - AI returns confidence                      → status = confidence >= 70
  //
  // Never auto-approve in production without a real review.
  const info = METRIC_INFO[metricKey];
  let aiConfidence = 0;
  let aiNotes = '';
  let aiStatus: 'approved' | 'flagged';
  // Non-null when the decision came from a fail-closed path (no key / parse
  // error) rather than the >=70 threshold. Used only to label the evidence
  // bundle's decision_reason — does not influence aiStatus.
  let aiFailClosedReason: string | null = null;

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

  const now = new Date().toISOString();
  const recordedAtValue = recordedAt ?? now;

  // ── Readout extraction (best-effort, fail-safe) ───────────────────────────
  //
  // If a device-readout file (HitTrax / Rapsodo / Blast / Trackman / etc.)
  // was uploaded, ask Claude Vision what value it shows for the metric being
  // verified. The extracted number is captured into the evidence bundle but
  // is intentionally NEVER consumed by the decision: aiStatus, aiConfidence,
  // the >=70 threshold, approve/flag, the 72h cooldown, and the response
  // shape all remain driven solely by the existing plausibility review.
  //
  // Any failure here (no file, fetch error, unsupported type, Vision error,
  // parse error) leaves readoutExtractedValue = null and is logged. It must
  // never throw out of this block.
  let readoutExtractedValue: number | null = null;
  if (typeof readoutUrl === 'string' && readoutUrl) {
    try {
      const fileRes = await fetch(readoutUrl);
      if (!fileRes.ok) {
        throw new Error(`storage returned HTTP ${fileRes.status}`);
      }

      // Prefer the storage server's Content-Type (strip any "; charset=...");
      // fall back to inferring from the URL extension when the header is
      // missing or generic.
      const headerType = (fileRes.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim();
      const mimeType =
        headerType && headerType !== 'application/octet-stream'
          ? headerType
          : (inferMimeFromUrl(readoutUrl) ?? headerType);

      const buffer     = await fileRes.arrayBuffer();
      const fileBase64 = Buffer.from(buffer).toString('base64');

      const extraction = await extractReadoutValue({
        metricKey,
        metricLabel: info.label,
        unit:        info.unit,
        fileBase64,
        mimeType,
      });
      readoutExtractedValue = extraction.value;
    } catch (err) {
      console.error('[verify-metric] readout extraction skipped:', err);
      // readoutExtractedValue stays null — capture-only, never alters decision.
    }
  }

  // ── Evidence-bundle row in metric_sessions (every attempt, approve + flag) ──
  //
  // Fail-safe: if this insert errors or throws, log it and continue with
  // sessionId = null. Evidence capture must NEVER block or alter the
  // verification response.
  const decisionReason = aiFailClosedReason
    ? `fail-closed: ${aiFailClosedReason}`
    : (aiStatus === 'approved'
        ? `ai_confidence ${aiConfidence} >= 70`
        : `ai_confidence ${aiConfidence} < 70`);

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
        readout_file_url:        readoutUrl ?? null,
        readout_extracted_value: readoutExtractedValue,
        ai_confidence:           aiConfidence,
        ai_notes:                aiNotes || null,
        status:                  aiStatus,
        decision_reason:         decisionReason,
        session_date:            sessionDateValue,
        verification_type:       'coach_verified',
        athlete_context:         athleteSnapshot ?? null,
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
    status:      aiStatus,
    aiConfidence,
    aiNotes,
  });
}
