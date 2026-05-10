/**
 * seed-dream-connections.mjs
 * --------------------------
 * Idempotently connects Dream's coach to 5 seed_test_* athletes so that the
 * Step 4 filter/sort UI on My Athletes has meaningful test data.
 *
 * Idempotency: SELECT (coach_id, athlete_id) first, skip if a row exists,
 * insert otherwise. Avoids depending on a unique-constraint name.
 *
 * Reads only Korbin's prior connection (~5d ago) — we straddle that with the
 * staggered offsets below so "Connected date desc" sort interleaves seeded
 * picks with the existing Korbin row.
 *
 * Mutates only coach_athlete_connections — never athletes or anything else.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const db = createClient(url, key);

const DREAM_COACH_ID = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';

const NOW = Date.now();
const day = (n) => new Date(NOW - n * 86400000).toISOString();

// 5 picks: 5 distinct positions (no CF/P — Korbin), 3 distinct grad years,
// 5 distinct states (1 CA + 4 non-CA), 3 verified + 2 unverified.
// Offsets straddle Korbin's existing ~5d row.
const PICKS = [
  { clerk_id: 'seed_test_14', name: 'Ryan Park',     pos: 'SS', gy: 2026, st: 'CA', verified: true,  daysAgo: 1  },
  { clerk_id: 'seed_test_16', name: 'Caleb Booker',  pos: '3B', gy: 2028, st: 'IL', verified: false, daysAgo: 4  },
  { clerk_id: 'seed_test_18', name: 'Aiden Kessler', pos: '1B', gy: 2026, st: 'MA', verified: true,  daysAgo: 8  },
  { clerk_id: 'seed_test_23', name: 'Sawyer Jones',  pos: 'DH', gy: 2030, st: 'WA', verified: false, daysAgo: 14 },
  { clerk_id: 'seed_test_20', name: 'Lucas Harper',  pos: 'C',  gy: 2026, st: 'GA', verified: true,  daysAgo: 21 },
];

console.log(`Seeding ${PICKS.length} connections for coach ${DREAM_COACH_ID}…\n`);

let inserted = 0;
let skipped  = 0;
const insertedDetails = [];

for (const p of PICKS) {
  const { data: existing, error: selErr } = await db
    .from('coach_athlete_connections')
    .select('id, connected_at')
    .eq('coach_id',   DREAM_COACH_ID)
    .eq('athlete_id', p.clerk_id)
    .maybeSingle();

  if (selErr) {
    console.error(`SELECT failed for ${p.clerk_id}:`, selErr);
    process.exit(1);
  }

  if (existing) {
    skipped++;
    console.log(`  SKIP   ${p.clerk_id.padEnd(14)} ${p.name.padEnd(15)} — already connected at ${existing.connected_at}`);
    continue;
  }

  const connected_at = day(p.daysAgo);
  const { error: insErr } = await db
    .from('coach_athlete_connections')
    .insert({ coach_id: DREAM_COACH_ID, athlete_id: p.clerk_id, connected_at });

  if (insErr) {
    console.error(`INSERT failed for ${p.clerk_id}:`, insErr);
    process.exit(1);
  }

  inserted++;
  insertedDetails.push({ ...p, connected_at });
  console.log(`  INSERT ${p.clerk_id.padEnd(14)} ${p.name.padEnd(15)} → ${connected_at} (${p.daysAgo}d ago)`);
}

console.log('\n──────────────────────────────────────────────');
console.log(`Inserted: ${inserted}`);
console.log(`Skipped (already connected): ${skipped}`);

if (insertedDetails.length) {
  console.log('\nInserted athletes (most-recent connection first):');
  for (const d of insertedDetails) {
    const v = d.verified ? '◆' : ' ';
    console.log(`  • ${d.name.padEnd(15)} ${d.pos.padEnd(2)}  '${String(d.gy).slice(-2)}  ${d.st}  ${v}  ${String(d.daysAgo).padStart(2)}d ago  (${d.connected_at})`);
  }
}

// Final tally for sanity
const { count: total } = await db
  .from('coach_athlete_connections')
  .select('*', { count: 'exact', head: true })
  .eq('coach_id', DREAM_COACH_ID);
console.log(`\nDream now has ${total ?? '?'} total connection${total === 1 ? '' : 's'}.`);
