/**
 * test-discover-filters.mjs
 * Mirrors the API logic to verify the filter combos return the right counts.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

const COACH = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';

const { data: conns } = await db.from('coach_athlete_connections').select('athlete_id').eq('coach_id', COACH);
const excluded = (conns ?? []).map(c => c.athlete_id);
console.log('connected:', excluded);

async function run(label, fn) {
  let q = db.from('athletes').select('clerk_user_id, first_name, last_name, position, home_state, gpa_unweighted, fastball_velocity_mph, exit_velocity_mph', { count: 'exact' });
  if (excluded.length) q = q.not('clerk_user_id', 'in', `(${excluded.map(id => `"${id}"`).join(',')})`);
  q = fn(q);
  const { data, count, error } = await q;
  if (error) { console.log(`✗ ${label}: ${error.message}`); return; }
  console.log(`\n${label}: count=${count}, sample:`, (data ?? []).slice(0, 3).map(r => `${r.first_name} ${r.last_name} ${r.position}/${r.home_state}`));
}

await run('No filters (all discoverable)',          q => q);
await run('position=P',                             q => q.eq('position', 'P'));
await run('position=P + fbVeloMin=85',              q => q.eq('position', 'P').gte('fastball_velocity_mph', 85));
await run('state=CA',                               q => q.eq('home_state', 'CA'));
await run('Sort by GPA desc (top 5)',               q => q.order('gpa_unweighted', { ascending: false, nullsFirst: false }).range(0, 4));
await run('exitVeloMin=95 (sluggers)',              q => q.gte('exit_velocity_mph', 95));
await run('throws=L + bats=L',                      q => q.eq('throws', 'L').eq('bats', 'L'));
await run('gradYearMin=2026, gradYearMax=2027',     q => q.gte('grad_year', 2026).lte('grad_year', 2027));
