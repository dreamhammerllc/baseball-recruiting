/**
 * Write-through helper for coach-verified PBs.
 *
 * Coach approval publishes a row to `athlete_metrics`. For a small subset of
 * metric_keys, the same value also lives in denormalized columns elsewhere:
 *   - 3 keys map to the headline `athletes.*_mph` / `*_seconds` columns
 *     (exit_velocity → exit_velocity_mph, fastball_velocity → fastball_velocity_mph,
 *     sixty_yard_dash → sixty_yard_dash_seconds)
 *   - 4 keys map to `athlete_pitches.velocity` via PITCH_TYPE_TO_METRIC_KEY
 *     (fastball_velocity → fastball_4seam OR fastball_2seam, slider_velocity →
 *     slider, curveball_velocity → curveball, changeup_velocity → changeup)
 *
 * After every coach-approved publish, this helper reads the athlete's current
 * coach-verified PB from `athlete_metrics` and propagates it to whichever of
 * the two denormalized stores apply.
 *
 * Fastball slot picker: faster-of-the-two. When the athlete has both a
 * fastball_4seam and fastball_2seam slot, the slot with the higher current
 * velocity wins (ties broken by lowest pitch_slot; NULL velocity loses).
 * Coach radar guns almost always capture the hardest fastball, which is
 * usually the 4-seam — this rule preserves a slower 2-seam slot from being
 * overwritten when a 4-seam slot is present, and vice versa.
 *
 * Fail-safe by contract: this function NEVER throws. Each of the three DB
 * operations is independently try/caught and any failure is logged. The
 * publish path (verify-metric / review-resolve) must always succeed even if
 * write-through has an issue.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const ATHLETES_DENORM_COL: Record<string, string> = {
  exit_velocity:     'exit_velocity_mph',
  fastball_velocity: 'fastball_velocity_mph',
  sixty_yard_dash:   'sixty_yard_dash_seconds',
};

const METRIC_KEY_TO_PITCH_TYPES: Record<string, string[]> = {
  fastball_velocity:  ['fastball_4seam', 'fastball_2seam'],
  slider_velocity:    ['slider'],
  curveball_velocity: ['curveball'],
  changeup_velocity:  ['changeup'],
};

export async function writeThroughCoachVerified(
  db: SupabaseClient,
  athleteClerkId: string,
  metricKey: string,
): Promise<void> {
  const denormCol  = ATHLETES_DENORM_COL[metricKey] ?? null;
  const pitchTypes = METRIC_KEY_TO_PITCH_TYPES[metricKey] ?? null;

  // Nothing to write through for this metric.
  if (!denormCol && !pitchTypes) return;

  // ── Read the current coach-verified PB ────────────────────────────────────
  let pbValue: number | null = null;
  try {
    const { data: pbRow, error: pbErr } = await db
      .from('athlete_metrics')
      .select('value')
      .eq('athlete_clerk_id',  athleteClerkId)
      .eq('metric_key',        metricKey)
      .eq('verification_type', 'coach_verified')
      .eq('is_personal_best',  true)
      .limit(1)
      .maybeSingle();

    if (pbErr) {
      console.error('[writeThroughCoachVerified] PB lookup error:', pbErr.message);
      return;
    }
    if (!pbRow || pbRow.value == null) return; // nothing to propagate
    pbValue = Number(pbRow.value);
    if (!Number.isFinite(pbValue)) {
      console.error('[writeThroughCoachVerified] PB value is not finite:', pbRow.value);
      return;
    }
  } catch (err) {
    console.error('[writeThroughCoachVerified] PB lookup threw:', err);
    return;
  }

  // ── (c) Update athletes denormalized column when applicable ───────────────
  if (denormCol) {
    try {
      const { error: athErr } = await db
        .from('athletes')
        .update({ [denormCol]: pbValue })
        .eq('clerk_user_id', athleteClerkId);
      if (athErr) {
        console.error('[writeThroughCoachVerified] athletes update error:', athErr.message);
      }
    } catch (err) {
      console.error('[writeThroughCoachVerified] athletes update threw:', err);
    }
  }

  // ── (d) Update the matching athlete_pitches slot when applicable ──────────
  if (pitchTypes) {
    try {
      // Faster-of-the-two rule: among matching pitch_types, pick the slot
      // with the highest current velocity (ties → lowest pitch_slot; NULL
      // velocity loses). For single-element pitchTypes arrays the ordering
      // trivially picks the only matching slot if it exists.
      const { data: slotRow, error: slotSelErr } = await db
        .from('athlete_pitches')
        .select('id')
        .eq('athlete_clerk_id', athleteClerkId)
        .in('pitch_type', pitchTypes)
        .order('velocity',   { ascending: false, nullsFirst: false })
        .order('pitch_slot', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (slotSelErr) {
        console.error('[writeThroughCoachVerified] pitch slot lookup error:', slotSelErr.message);
        return;
      }
      if (!slotRow) return; // athlete hasn't claimed this pitch type — silently skip

      const { error: slotUpdErr } = await db
        .from('athlete_pitches')
        .update({ velocity: pbValue, last_updated_at: new Date().toISOString() })
        .eq('id', slotRow.id);
      if (slotUpdErr) {
        console.error('[writeThroughCoachVerified] pitch slot update error:', slotUpdErr.message);
      }
    } catch (err) {
      console.error('[writeThroughCoachVerified] pitch slot update threw:', err);
    }
  }
}
