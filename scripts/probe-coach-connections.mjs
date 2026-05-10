/**
 * probe-coach-connections.mjs
 * ---------------------------
 * Phase 1 schema check before writing seed-dream-connections.mjs.
 *  1. Show columns of coach_athlete_connections (sample row or candidate probe).
 *  2. Show Dream's existing connections by both possible coach_id forms.
 *  3. Confirm coach_id type (text Clerk id vs uuid coaches.id).
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

const DREAM_CLERK = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';
const DREAM_UUID  = '2ddccdcc-d8f0-40d2-a4c8-2ac73d554dfd';

// ── 1. Total rows + sample row column shape ─────────────────────────────────
const { count: total, error: countErr } = await db
  .from('coach_athlete_connections')
  .select('*', { count: 'exact', head: true });
if (countErr) { console.error('count err:', countErr); process.exit(1); }
console.log(`coach_athlete_connections total rows: ${total}`);

const { data: sample } = await db
  .from('coach_athlete_connections').select('*').limit(1);

if (sample && sample.length > 0) {
  console.log('\n=== columns (from sample row) ===');
  for (const [k, v] of Object.entries(sample[0])) {
    const t = v === null ? 'null' : typeof v;
    const preview = v === null ? 'null' : String(v).slice(0, 60);
    console.log(`  ${k.padEnd(20)} (${t.padEnd(7)}) → ${preview}`);
  }
} else {
  console.log('\n=== no rows yet — probing candidate columns ===');
  const candidates = [
    'id', 'coach_id', 'coach_clerk_id', 'athlete_id', 'athlete_clerk_id',
    'connected_at', 'created_at', 'updated_at',
    'status', 'connection_type', 'invitation_id', 'source',
  ];
  for (const c of candidates) {
    const { error } = await db.from('coach_athlete_connections').select(c).limit(0);
    if (error) {
      if (/does not exist/i.test(error.message) || error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST100') {
        console.log(`  ${c.padEnd(20)} : NOT PRESENT`);
      } else {
        console.log(`  ${c.padEnd(20)} : err ${error.code} ${error.message}`);
      }
    } else {
      console.log(`  ${c.padEnd(20)} : PRESENT ✓`);
    }
  }
}

// ── 2. Dream's connections — try both coach_id values ───────────────────────
console.log(`\n=== Dream's connections WHERE coach_id = '${DREAM_CLERK}' (clerk text) ===`);
const { data: byClerk, error: cErr } = await db
  .from('coach_athlete_connections').select('*').eq('coach_id', DREAM_CLERK);
if (cErr) console.log('err:', cErr.code, cErr.message);
else {
  console.log(`  rows: ${byClerk?.length ?? 0}`);
  for (const r of (byClerk ?? [])) console.log(`  →`, JSON.stringify(r));
}

console.log(`\n=== Dream's connections WHERE coach_id = '${DREAM_UUID}' (uuid) ===`);
const { data: byUuid, error: uErr } = await db
  .from('coach_athlete_connections').select('*').eq('coach_id', DREAM_UUID);
if (uErr) console.log('err:', uErr.code, uErr.message);
else {
  console.log(`  rows: ${byUuid?.length ?? 0}`);
  for (const r of (byUuid ?? [])) console.log(`  →`, JSON.stringify(r));
}

// ── 3. Type check by attempting to insert a no-op pattern (peek through error) ─
// We don't actually insert. Instead we use a UUID-shaped value vs text-shaped value
// in a SELECT and observe parse errors.
console.log('\n=== coach_id type probe via filter shape ===');
{
  // If column is uuid, filtering by clerk-style 'user_xxx' will fail to parse.
  const { error } = await db
    .from('coach_athlete_connections')
    .select('id')
    .eq('coach_id', 'user_TYPE_PROBE_NOT_REAL')
    .limit(0);
  if (error) {
    if (/invalid input syntax for type uuid/i.test(error.message) || error.code === '22P02') {
      console.log('  coach_id type = UUID (rejected text-shaped value)');
    } else {
      console.log('  unexpected error:', error.code, error.message);
    }
  } else {
    console.log('  coach_id type = TEXT (accepted text-shaped value, returned 0 rows)');
  }
}

// Also probe athlete_id
{
  const { error } = await db
    .from('coach_athlete_connections')
    .select('id')
    .eq('athlete_id', 'user_TYPE_PROBE_NOT_REAL')
    .limit(0);
  if (error) {
    if (/invalid input syntax for type uuid/i.test(error.message) || error.code === '22P02') {
      console.log('  athlete_id type = UUID (rejected text-shaped value)');
    } else {
      console.log('  unexpected error:', error.code, error.message);
    }
  } else {
    console.log('  athlete_id type = TEXT (accepted text-shaped value, returned 0 rows)');
  }
}

// ── Bonus: confirm Korbin is connected so we know baseline ──────────────────
const KORBIN_CLERK = 'user_3Cx45lltJlEnKk4A4vGgMejEUgg';
console.log('\n=== Sanity: is Korbin Williams connected to Dream? ===');
const { data: korbin } = await db
  .from('coach_athlete_connections')
  .select('*')
  .or(`coach_id.eq.${DREAM_CLERK},coach_id.eq.${DREAM_UUID}`)
  .eq('athlete_id', KORBIN_CLERK);
console.log(`  rows: ${korbin?.length ?? 0}`);
for (const r of (korbin ?? [])) console.log(`  →`, JSON.stringify(r));
