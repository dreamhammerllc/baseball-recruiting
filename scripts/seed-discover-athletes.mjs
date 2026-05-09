/**
 * seed-discover-athletes.mjs
 * --------------------------
 * Idempotent seed of 25 fake athletes for testing the Discover page.
 * Uses upsert on clerk_user_id so re-running mutates rather than duplicates.
 *
 * Cleanup with: node scripts/clear-seed-athletes.mjs
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

// Spread inserts over ~180 days so "Newest" sort is meaningful.
const NOW = Date.now();
const day = (n) => new Date(NOW - n * 86400000).toISOString();

// Photos: pravatar.cc IDs 1..15 → 15 with photos, 10 without.
const photoFor = (i) => i < 15 ? `https://i.pravatar.cc/300?img=${i + 1}` : null;

// Hand-crafted so distributions match the spec:
//  - 6 pitchers, 7 outfielders, 6 infielders, 3 catchers, 3 utility
//  - 5 CA + 4 TX + 3 FL + 3 GA + 10 others
//  - 7 verified (verification_tier=1 + subscription_tier='verified')
//  - bats/throws mix incl. switch hitters
const ATHLETES = [
  // ── Pitchers (6) ────────────────────────────────────────────────────────
  { fn: 'Jake',    ln: 'Carter',   pos: 'P',  st: 'CA', gy: 2027, gpa: 3.4, dash: 7.0, fb: 89, ev: null, b: 'R', t: 'R', verified: true,  daysAgo: 5,   ht: 73, wt: 185 },
  { fn: 'Mason',   ln: 'Lee',      pos: 'P',  st: 'TX', gy: 2026, gpa: 3.1, dash: 7.2, fb: 92, ev: null, b: 'L', t: 'L', verified: false, daysAgo: 18,  ht: 75, wt: 195 },
  { fn: 'Tyler',   ln: 'Brooks',   pos: 'P',  st: 'FL', gy: 2028, gpa: 3.7, dash: 7.1, fb: 85, ev: null, b: 'R', t: 'R', verified: false, daysAgo: 42,  ht: 72, wt: 175 },
  { fn: 'Carson',  ln: 'Reed',     pos: 'P',  st: 'OH', gy: 2027, gpa: 2.9, dash: 7.3, fb: 87, ev: null, b: 'R', t: 'R', verified: false, daysAgo: 71,  ht: 74, wt: 200 },
  { fn: 'Owen',    ln: 'Brady',    pos: 'P',  st: 'GA', gy: 2026, gpa: 3.5, dash: 7.0, fb: 90, ev: null, b: 'L', t: 'L', verified: true,  daysAgo: 95,  ht: 76, wt: 205 },
  { fn: 'Hunter',  ln: 'Cole',     pos: 'P',  st: 'CA', gy: 2029, gpa: 2.7, dash: 7.4, fb: 81, ev: null, b: 'R', t: 'R', verified: false, daysAgo: 130, ht: 71, wt: 170 },

  // ── Outfielders (7) ─────────────────────────────────────────────────────
  { fn: 'Jaden',   ln: 'Rivers',   pos: 'CF', st: 'CA', gy: 2026, gpa: 3.8, dash: 6.7, fb: null, ev: 95,  b: 'R', t: 'R', verified: true,  daysAgo: 12,  ht: 72, wt: 180 },
  { fn: 'Ethan',   ln: 'Diaz',     pos: 'RF', st: 'NY', gy: 2027, gpa: 3.2, dash: 6.9, fb: null, ev: 92,  b: 'L', t: 'L', verified: false, daysAgo: 28,  ht: 73, wt: 185 },
  { fn: 'Wyatt',   ln: 'Foster',   pos: 'LF', st: 'FL', gy: 2028, gpa: 3.0, dash: 7.0, fb: null, ev: 88,  b: 'R', t: 'R', verified: false, daysAgo: 47,  ht: 71, wt: 175 },
  { fn: 'Cole',    ln: 'Sanchez',  pos: 'CF', st: 'AZ', gy: 2027, gpa: 3.6, dash: 6.8, fb: null, ev: 90,  b: 'S', t: 'R', verified: true,  daysAgo: 60,  ht: 72, wt: 180 },
  { fn: 'Parker',  ln: 'Quinn',    pos: 'RF', st: 'CA', gy: 2029, gpa: 3.3, dash: 6.9, fb: null, ev: 87,  b: 'R', t: 'R', verified: false, daysAgo: 88,  ht: 70, wt: 170 },
  { fn: 'Logan',   ln: 'Vance',    pos: 'LF', st: 'TX', gy: 2026, gpa: 2.8, dash: 7.1, fb: null, ev: 100, b: 'L', t: 'L', verified: true,  daysAgo: 110, ht: 74, wt: 200 },
  { fn: 'Bennett', ln: 'Mills',    pos: 'CF', st: 'NC', gy: 2030, gpa: 3.9, dash: 6.6, fb: null, ev: 85,  b: 'R', t: 'R', verified: false, daysAgo: 145, ht: 70, wt: 165 },

  // ── Infielders (6) ──────────────────────────────────────────────────────
  { fn: 'Ryan',    ln: 'Park',     pos: 'SS', st: 'CA', gy: 2026, gpa: 4.0, dash: 6.8, fb: null, ev: 93,  b: 'R', t: 'R', verified: true,  daysAgo: 8,   ht: 72, wt: 175 },
  { fn: 'Dylan',   ln: 'Marsh',    pos: '2B', st: 'GA', gy: 2027, gpa: 3.4, dash: 7.0, fb: null, ev: 89,  b: 'L', t: 'R', verified: false, daysAgo: 35,  ht: 71, wt: 170 },
  { fn: 'Caleb',   ln: 'Booker',   pos: '3B', st: 'IL', gy: 2028, gpa: 2.9, dash: 7.2, fb: null, ev: 91,  b: 'R', t: 'R', verified: false, daysAgo: 55,  ht: 73, wt: 190 },
  { fn: 'Noah',    ln: 'Sterling', pos: 'SS', st: 'FL', gy: 2029, gpa: 3.5, dash: 6.9, fb: null, ev: 88,  b: 'R', t: 'R', verified: false, daysAgo: 78,  ht: 71, wt: 175 },
  { fn: 'Aiden',   ln: 'Kessler',  pos: '1B', st: 'MA', gy: 2026, gpa: 3.7, dash: 7.0, fb: null, ev: 95,  b: 'S', t: 'R', verified: true,  daysAgo: 102, ht: 74, wt: 200 },
  { fn: 'Brody',   ln: 'Hayes',    pos: '3B', st: 'TX', gy: 2027, gpa: 2.6, dash: 7.1, fb: null, ev: 80,  b: 'L', t: 'L', verified: false, daysAgo: 138, ht: 73, wt: 195 },

  // ── Catchers (3) ────────────────────────────────────────────────────────
  { fn: 'Lucas',   ln: 'Harper',   pos: 'C',  st: 'GA', gy: 2026, gpa: 3.3, dash: 7.4, fb: null, ev: 92,  b: 'R', t: 'R', verified: true,  daysAgo: 22,  ht: 71, wt: 195 },
  { fn: 'Knox',    ln: 'Patel',    pos: 'C',  st: 'CA', gy: 2027, gpa: 3.8, dash: 7.5, fb: null, ev: 87,  b: 'R', t: 'R', verified: false, daysAgo: 65,  ht: 70, wt: 185 },
  { fn: 'Eli',     ln: 'Decker',   pos: 'C',  st: 'OR', gy: 2028, gpa: 3.0, dash: 7.4, fb: null, ev: 94,  b: 'L', t: 'R', verified: false, daysAgo: 120, ht: 72, wt: 200 },

  // ── Utility / DH (3) ────────────────────────────────────────────────────
  { fn: 'Sawyer',  ln: 'Jones',    pos: 'DH', st: 'WA', gy: 2030, gpa: 3.2, dash: 6.8, fb: null, ev: 86,  b: 'R', t: 'R', verified: false, daysAgo: 38,  ht: 71, wt: 175 },
  { fn: 'Asher',   ln: 'Klein',    pos: 'DH', st: 'PA', gy: 2026, gpa: 3.6, dash: 6.9, fb: null, ev: 105, b: 'S', t: 'R', verified: true,  daysAgo: 92,  ht: 75, wt: 215 },
  { fn: 'Theo',    ln: 'Mendez',   pos: 'DH', st: 'NV', gy: 2031, gpa: 3.9, dash: 7.0, fb: null, ev: 84,  b: 'R', t: 'R', verified: false, daysAgo: 165, ht: 70, wt: 170 },
];

const rows = ATHLETES.map((a, i) => ({
  clerk_user_id:           `seed_test_${String(i + 1).padStart(2, '0')}`,
  email:                   `seed.test+${i + 1}@example.com`,
  first_name:              a.fn,
  last_name:               a.ln,
  full_name:               `${a.fn} ${a.ln}`,
  username:                `${a.fn}_${a.ln}`.toLowerCase(),
  photo_url:               photoFor(i),
  position:                a.pos,
  grad_year:               a.gy,
  home_state:              a.st,
  height_inches:           a.ht,
  weight_lbs:              a.wt,
  bats:                    a.b,
  throws:                  a.t,
  gpa_unweighted:          a.gpa,
  sixty_yard_dash_seconds: a.dash,
  fastball_velocity_mph:   a.fb,
  exit_velocity_mph:       a.ev,
  subscription_tier:       a.verified ? 'verified' : 'free',
  // DB constraint: verification_tier must be NULL or >= 1.
  verification_tier:       a.verified ? 1 : null,
  created_at:              day(a.daysAgo),
  updated_at:              day(a.daysAgo),
}));

console.log(`Upserting ${rows.length} seed athletes…`);

const { data, error } = await db
  .from('athletes')
  .upsert(rows, { onConflict: 'clerk_user_id' })
  .select('clerk_user_id, first_name, last_name, position, home_state');

if (error) {
  console.error('UPSERT FAILED:', error);
  process.exit(1);
}

console.log(`OK — ${data?.length ?? 0} rows upserted.`);

// Distribution check
const byPos = {};
const bySt  = {};
for (const r of rows) {
  byPos[r.position] = (byPos[r.position] ?? 0) + 1;
  bySt[r.home_state] = (bySt[r.home_state] ?? 0) + 1;
}
console.log('\nPosition distribution:');
for (const [k, v] of Object.entries(byPos).sort()) console.log(`  ${k.padEnd(3)} ${v}`);
console.log('\nState distribution:');
for (const [k, v] of Object.entries(bySt).sort((a, b) => b[1] - a[1])) console.log(`  ${k} ${v}`);

const verifiedCount = rows.filter(r => r.verification_tier > 0).length;
const photoCount    = rows.filter(r => r.photo_url).length;
console.log(`\nVerified (paid): ${verifiedCount}`);
console.log(`With photos:     ${photoCount}`);
