/**
 * audit-discover-columns.mjs
 * --------------------------
 * For Step 2 expanded filters: list every relevant column on `athletes`
 * (excluding height/weight) and every distinct metric_key on `athlete_metrics`.
 * Used to decide which filters can be implemented without fabricating columns.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

// ── Columns on athletes (full listing via PostgREST OpenAPI) ─────────────────
const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});
const spec = await res.json();
const athletesCols = Object.keys(spec.definitions?.athletes?.properties ?? {});

const filterCandidates = [
  // primary
  'position', 'secondary_position', 'grad_year', 'home_state', 'state',
  'throws', 'bats', 'gpa_unweighted', 'gpa_weighted', 'gpa',
  // athletic / speed
  'sixty_yard_dash_seconds', 'dash_60', 'home_to_first', 'vertical_jump',
  'arm_strength',
  // hitting
  'exit_velocity_mph', 'exit_velocity', 'bat_speed', 'launch_angle',
  'distance', 'barrel_percent', 'barrel_pct', 'attack_angle', 'batting_avg',
  // pitching
  'fastball_velocity_mph', 'velocity', 'curveball_velo', 'curveball_velocity',
  'slider_velo', 'slider_velocity', 'secondary_pitch', 'secondary_pitch_velo',
  'extension', 'era', 'innings_pitched',
  // catcher
  'pop_time',
  // academic
  'sat_score', 'act_score',
];

console.log('═══ ATHLETES COLUMNS — present (P) vs missing (✗) ═══');
for (const c of filterCandidates) {
  const present = athletesCols.includes(c);
  console.log(`  ${present ? 'P' : '✗'}  ${c}`);
}

// ── Distinct metric_key values present in athlete_metrics ────────────────────
const { data: metricRows, error: mErr } = await db
  .from('athlete_metrics')
  .select('metric_key, is_personal_best, value, unit')
  .order('metric_key');

if (mErr) {
  console.error('athlete_metrics query failed:', mErr);
  process.exit(1);
}

const counts = {};
for (const r of metricRows ?? []) {
  const key = r.metric_key;
  counts[key] ??= { total: 0, pb: 0, sampleValue: r.value, unit: r.unit };
  counts[key].total++;
  if (r.is_personal_best) counts[key].pb++;
}

console.log('\n═══ DISTINCT metric_key VALUES IN athlete_metrics ═══');
const entries = Object.entries(counts).sort();
if (entries.length === 0) {
  console.log('  (no rows in athlete_metrics)');
} else {
  console.log('  metric_key                     | total | PBs | sample value | unit');
  for (const [k, v] of entries) {
    console.log(`  ${k.padEnd(30)} | ${String(v.total).padStart(5)} | ${String(v.pb).padStart(3)} | ${String(v.sampleValue).padStart(12)} | ${v.unit ?? ''}`);
  }
}

// ── How many athletes are in the DB now? ─────────────────────────────────────
const { count } = await db.from('athletes').select('*', { count: 'exact', head: true });
console.log(`\nTotal athletes: ${count}`);
