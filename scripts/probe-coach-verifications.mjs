/**
 * probe-coach-verifications.mjs
 * -----------------------------
 * READ-ONLY. Discovers the coach_verifications table shape from a sample row
 * and prints 2-3 rows for Korbin (athlete_clerk_id) for context. Joins to
 * coaches.full_name so the human author of each verification is visible.
 *
 * Mutates nothing. SELECTs only.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const db = createClient(url, key);

const KORBIN = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg';

console.log('=== coach_verifications: discover columns from a sample row ===');
const { data: sample, error: sampleErr } = await db
  .from('coach_verifications')
  .select('*')
  .limit(1);
if (sampleErr) { console.error(sampleErr.message); process.exit(1); }
if (!sample || sample.length === 0) {
  console.log('(no rows in table)');
} else {
  const row = sample[0];
  for (const k of Object.keys(row)) {
    const v = row[k];
    const t = v === null ? 'null' : typeof v;
    console.log(`  ${k.padEnd(20)} ${t}`);
  }
}

console.log('\n=== coach_verifications rows for Korbin ===');
const { data: rows, error } = await db
  .from('coach_verifications')
  .select('id, coach_id, athlete_clerk_id, metric_key, value, status, ai_reviewed_at, approved_at, video_url, recorded_at, created_at')
  .eq('athlete_clerk_id', KORBIN)
  .order('created_at', { ascending: false });
if (error) { console.error(error.message); process.exit(1); }

if (!rows || rows.length === 0) {
  console.log('(no rows for Korbin)');
} else {
  // Join coach name
  const coachIds = [...new Set(rows.map(r => r.coach_id))];
  const { data: coaches } = await db
    .from('coaches')
    .select('id, full_name, organization')
    .in('id', coachIds);
  const coachMap = new Map((coaches ?? []).map(c => [c.id, c]));

  console.log(`Found ${rows.length} verification(s):\n`);
  for (const r of rows) {
    const c = coachMap.get(r.coach_id);
    console.log(`  ${r.metric_key} = ${r.value}`);
    console.log(`    status:      ${r.status}`);
    console.log(`    coach:       ${c ? c.full_name + ' (' + c.organization + ')' : '(unknown)'}`);
    console.log(`    video_url:   ${r.video_url ?? '(none)'}`);
    console.log(`    ai_reviewed: ${r.ai_reviewed_at ?? '(none)'}`);
    console.log(`    approved_at: ${r.approved_at ?? '(none)'}`);
    console.log(`    recorded_at: ${r.recorded_at}`);
    console.log(`    created_at:  ${r.created_at}`);
    console.log(`    rowId:       ${r.id}`);
    console.log('');
  }
}
