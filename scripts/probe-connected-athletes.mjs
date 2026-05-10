/**
 * probe-connected-athletes.mjs
 * ----------------------------
 * 4b gate check: verify home_state and updated_at are populated on Dream's
 * 6 connected athletes (Korbin + 5 seeded picks).
 *
 * Read-only.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const db = createClient(url, key);

const IDS = [
  'user_3Cx45lltJlEnKk4A4vGgMejEUgg',  // Korbin
  'seed_test_14',
  'seed_test_16',
  'seed_test_18',
  'seed_test_20',
  'seed_test_23',
];

const { data, error } = await db
  .from('athletes')
  .select('clerk_user_id, first_name, home_state, updated_at')
  .in('clerk_user_id', IDS)
  .order('clerk_user_id');

if (error) { console.error(error); process.exit(1); }

console.log(`Rows: ${data.length}\n`);

let nullStates = 0, nullUpdated = 0;
for (const r of data) {
  const stateDisp = r.home_state === null ? 'NULL ⚠' : r.home_state;
  const updDisp   = r.updated_at === null ? 'NULL ⚠' : r.updated_at;
  if (r.home_state === null) nullStates++;
  if (r.updated_at === null) nullUpdated++;
  console.log(`  ${r.clerk_user_id.padEnd(35)} ${(r.first_name ?? '?').padEnd(12)} state=${String(stateDisp).padEnd(8)} updated_at=${updDisp}`);
}

const missingIds = IDS.filter(id => !data.find(r => r.clerk_user_id === id));
if (missingIds.length) {
  console.log(`\n⚠ MISSING athlete rows for: ${missingIds.join(', ')}`);
}

console.log(`\nNull home_state: ${nullStates}`);
console.log(`Null updated_at: ${nullUpdated}`);
