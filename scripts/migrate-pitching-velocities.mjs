/**
 * migrate-pitching-velocities.mjs
 * --------------------------------
 * One-time migration: move pitching personal-best rows from
 * athlete_metrics into the new athlete_pitches table.
 *
 * Source: athlete_metrics where
 *   metric_key IN ('fastball_velocity','slider_velocity',
 *                  'curveball_velocity','changeup_velocity')
 *   AND is_personal_best = true.
 *
 * metric_key → pitch_type mapping:
 *   fastball_velocity  → fastball_4seam
 *   slider_velocity    → slider
 *   curveball_velocity → curveball
 *   changeup_velocity  → changeup
 * Any unmapped key is warned and skipped.
 *
 * Slot assignment: per athlete, pitch_slot is assigned 1..N in
 * encounter order (ordered by recorded_at ASC for determinism).
 * If an athlete has more than 5 mappable rows, the overflow is
 * warned and skipped.
 *
 * Copies: value→velocity, verification_type, source_label,
 * ai_confidence, video_url, recorded_at→last_updated_at.
 * Leaves spin_rate, h_break, v_break, extension NULL.
 *
 * Idempotency: per (athlete_clerk_id, pitch_slot), SELECT first
 * and SKIP if a row already exists in athlete_pitches. We never
 * overwrite — athlete edits in athlete_pitches are sacred.
 *
 * Does NOT delete from athlete_metrics. Source cleanup is a
 * later step (S32).
 *
 * CLI:
 *   node scripts/migrate-pitching-velocities.mjs           # dry-run (default)
 *   node scripts/migrate-pitching-velocities.mjs --commit  # perform inserts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key);

const COMMIT = process.argv.includes('--commit');
const MODE   = COMMIT ? 'COMMIT' : 'DRY-RUN';

const SOURCE_METRIC_KEYS = [
  'fastball_velocity',
  'slider_velocity',
  'curveball_velocity',
  'changeup_velocity',
];

const METRIC_TO_PITCH_TYPE = {
  fastball_velocity:  'fastball_4seam',
  slider_velocity:    'slider',
  curveball_velocity: 'curveball',
  changeup_velocity:  'changeup',
};

console.log(`Mode: ${MODE}`);
console.log('Reading personal-best pitching metrics from athlete_metrics…\n');

const { data: rows, error: selErr } = await db
  .from('athlete_metrics')
  .select('id, athlete_clerk_id, metric_key, value, verification_type, source_label, ai_confidence, video_url, recorded_at')
  .in('metric_key', SOURCE_METRIC_KEYS)
  .eq('is_personal_best', true)
  .order('athlete_clerk_id', { ascending: true })
  .order('recorded_at',      { ascending: true });

if (selErr) {
  console.error('SELECT athlete_metrics failed:', selErr);
  process.exit(1);
}

if (!rows || rows.length === 0) {
  console.log('No personal-best pitching rows found in athlete_metrics. Nothing to migrate.');
  process.exit(0);
}

// Group by athlete (preserves encounter order from the ORDER BY above).
const byAthlete = new Map();
for (const r of rows) {
  if (!byAthlete.has(r.athlete_clerk_id)) byAthlete.set(r.athlete_clerk_id, []);
  byAthlete.get(r.athlete_clerk_id).push(r);
}

// Bulk-fetch existing athlete_pitches rows for affected athletes so we can
// short-circuit on (athlete_clerk_id, pitch_slot) without a roundtrip per row.
const athleteIds = [...byAthlete.keys()];
const { data: existing, error: existingErr } = await db
  .from('athlete_pitches')
  .select('athlete_clerk_id, pitch_slot')
  .in('athlete_clerk_id', athleteIds);

if (existingErr) {
  console.error('SELECT athlete_pitches failed:', existingErr);
  process.exit(1);
}

const existingSlots = new Set((existing ?? []).map(e => `${e.athlete_clerk_id}::${e.pitch_slot}`));

console.log(`Athletes with pitching rows: ${byAthlete.size}`);
console.log(`Source rows to evaluate:     ${rows.length}\n`);

// Table header
const header = [
  'athlete_clerk_id'.padEnd(34),
  'slot'.padStart(4),
  'pitch_type'.padEnd(16),
  'velocity'.padStart(8),
  'verification_type'.padEnd(22),
  'source_label'.padEnd(28),
  'action',
].join('  ');
console.log(header);
console.log('─'.repeat(header.length + 16));

let wouldInsert  = 0;
let inserted     = 0;
let skippedExist = 0;
let skippedFull  = 0;
let warnedMap    = 0;

for (const [athleteId, athleteRows] of byAthlete) {
  let nextSlot = 1;
  for (const r of athleteRows) {
    const pitchType = METRIC_TO_PITCH_TYPE[r.metric_key];
    if (!pitchType) {
      console.warn(`  WARN unmapped metric_key=${r.metric_key} for ${athleteId} — skipping`);
      warnedMap++;
      continue;
    }
    if (nextSlot > 5) {
      console.warn(`  WARN ${athleteId} already has 5 pitches — skipping extra row (${r.metric_key} value=${r.value})`);
      skippedFull++;
      continue;
    }

    const slot    = nextSlot++;
    const slotKey = `${athleteId}::${slot}`;
    const exists  = existingSlots.has(slotKey);

    let action;
    if (exists) {
      action = 'SKIPPED (slot exists)';
      skippedExist++;
    } else if (COMMIT) {
      const { error: insErr } = await db.from('athlete_pitches').insert({
        athlete_clerk_id:  athleteId,
        pitch_slot:        slot,
        pitch_type:        pitchType,
        velocity:          r.value,
        verification_type: r.verification_type,
        source_label:      r.source_label,
        ai_confidence:     r.ai_confidence,
        video_url:         r.video_url,
        last_updated_at:   r.recorded_at,
      });
      if (insErr) {
        console.error(`INSERT failed for ${athleteId} slot ${slot}:`, insErr);
        process.exit(1);
      }
      action = 'INSERTED';
      inserted++;
      existingSlots.add(slotKey);
    } else {
      action = 'WOULD INSERT';
      wouldInsert++;
    }

    console.log([
      String(athleteId).padEnd(34),
      String(slot).padStart(4),
      String(pitchType).padEnd(16),
      String(r.value ?? '').padStart(8),
      String(r.verification_type ?? '').padEnd(22),
      String(r.source_label ?? '').padEnd(28),
      action,
    ].join('  '));
  }
}

console.log('\n──────────────────────────────────────────────');
console.log(`Mode:                  ${MODE}`);
console.log(`Source rows:           ${rows.length}`);
console.log(`Athletes:              ${byAthlete.size}`);
if (COMMIT) {
  console.log(`Inserted:              ${inserted}`);
} else {
  console.log(`Would insert:          ${wouldInsert}`);
}
console.log(`Skipped (slot exists): ${skippedExist}`);
console.log(`Skipped (>5 pitches):  ${skippedFull}`);
console.log(`Warned (unmapped key): ${warnedMap}`);
if (!COMMIT) {
  console.log('\nNo writes performed (dry-run). Re-run with --commit to apply.');
}
