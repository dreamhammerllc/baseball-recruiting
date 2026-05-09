/**
 * count-discoverable.mjs
 * ----------------------
 * Reports how many athletes Dream's coach account would see on the Discover
 * page. Two queries, JS merge — same algorithm the API will use.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

const DREAM_COACH_CLERK_ID = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';

const { count: total } = await db.from('athletes').select('*', { count: 'exact', head: true });

const { data: conns } = await db
  .from('coach_athlete_connections')
  .select('athlete_id')
  .eq('coach_id', DREAM_COACH_CLERK_ID);
const connectedIds = (conns ?? []).map(c => c.athlete_id);

console.log(`Total athletes:                 ${total}`);
console.log(`Dream's connected athletes:     ${connectedIds.length}`);
if (connectedIds.length) {
  console.log(`  - ${connectedIds.join('\n  - ')}`);
}

let discoverableCount = total ?? 0;
if (connectedIds.length) {
  const { count } = await db
    .from('athletes')
    .select('*', { count: 'exact', head: true })
    .not('clerk_user_id', 'in', `(${connectedIds.map(id => `"${id}"`).join(',')})`);
  discoverableCount = count ?? 0;
}

console.log(`\nDISCOVERABLE for Dream:         ${discoverableCount}`);
