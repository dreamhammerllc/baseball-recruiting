/**
 * verify-schema.mjs
 * -----------------
 * Probes existence and column shape for the tables we need before Session 22.
 *
 * Usage: node scripts/verify-schema.mjs
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

const TABLES = [
  'saved_athletes',
  'coach_evaluations',
  'coach_invitations',
  'coach_verifications',
  'coach_athlete_connections',
  'athletes',
];

for (const t of TABLES) {
  console.log(`\n=== ${t} ===`);
  const { data, error, status } = await db.from(t).select('*').limit(1);
  if (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message)) {
      console.log('  TABLE DOES NOT EXIST');
    } else {
      console.log('  ERROR:', error.code, error.message);
    }
    continue;
  }
  if (!data || data.length === 0) {
    console.log('  (table exists, no rows — column shape unknown from this query)');
    continue;
  }
  const cols = Object.keys(data[0]);
  for (const c of cols) {
    const v = data[0][c];
    const t = v === null ? 'null' : typeof v;
    console.log(`  - ${c.padEnd(32)} (${t})`);
  }
}

// Privacy/discoverability check: try to select known candidate columns from athletes
console.log('\n=== privacy/discoverability columns on athletes ===');
const candidates = ['is_discoverable', 'is_public', 'profile_visibility', 'is_searchable', 'profile_privacy'];
for (const c of candidates) {
  const { error } = await db.from('athletes').select(c).limit(1);
  if (error) {
    if (/column .* does not exist|could not find/i.test(error.message) || error.code === '42703' || error.code === 'PGRST204') {
      console.log(`  ${c.padEnd(28)} : NOT PRESENT`);
    } else {
      console.log(`  ${c.padEnd(28)} : err ${error.code} ${error.message}`);
    }
  } else {
    console.log(`  ${c.padEnd(28)} : PRESENT ✓`);
  }
}

// Confirm number of athletes (so we know we have content for discovery)
const { count } = await db.from('athletes').select('*', { count: 'exact', head: true });
console.log(`\nTotal athletes in DB: ${count ?? 'unknown'}`);

const { count: connCount } = await db.from('coach_athlete_connections').select('*', { count: 'exact', head: true });
console.log(`Total coach_athlete_connections: ${connCount ?? 'unknown'}`);

const { count: savedCount } = await db.from('saved_athletes').select('*', { count: 'exact', head: true });
console.log(`Total saved_athletes: ${savedCount ?? 'unknown'}`);
