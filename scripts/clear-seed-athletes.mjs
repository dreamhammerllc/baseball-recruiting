/**
 * clear-seed-athletes.mjs
 * -----------------------
 * Removes everything created by scripts/seed-discover-athletes.mjs:
 * the seed_test_* athletes plus any rows in coach_athlete_connections,
 * saved_athletes, or athlete_metrics that reference them.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

// Discover the IDs first so we don't depend on cascade behavior we haven't set up.
const { data: seedRows, error: findErr } = await db
  .from('athletes')
  .select('clerk_user_id')
  .like('clerk_user_id', 'seed_test_%');

if (findErr) {
  console.error('Lookup failed:', findErr);
  process.exit(1);
}

const ids = (seedRows ?? []).map(r => r.clerk_user_id);
console.log(`Found ${ids.length} seed_test_* athlete rows.`);

if (ids.length === 0) {
  console.log('Nothing to clean.');
  process.exit(0);
}

async function deleteByClerkId(table, column) {
  const { error, count } = await db
    .from(table)
    .delete({ count: 'exact' })
    .in(column, ids);
  if (error) {
    console.error(`  ${table}: FAILED — ${error.message}`);
  } else {
    console.log(`  ${table}: deleted ${count ?? 0}`);
  }
}

console.log('\nDeleting related rows:');
await deleteByClerkId('coach_athlete_connections', 'athlete_id');
await deleteByClerkId('saved_athletes',            'athlete_clerk_id');
await deleteByClerkId('athlete_metrics',           'athlete_clerk_id');

console.log('\nDeleting athletes:');
const { error: athErr, count } = await db
  .from('athletes')
  .delete({ count: 'exact' })
  .like('clerk_user_id', 'seed_test_%');

if (athErr) {
  console.error('  athletes: FAILED —', athErr.message);
  process.exit(1);
}
console.log(`  athletes: deleted ${count ?? 0}`);
console.log('\nDone.');
