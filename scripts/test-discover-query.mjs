/**
 * test-discover-query.mjs
 * Mirrors the discover API's algorithm with no auth, so we can confirm the
 * exclude-already-connected query works without 4xx auth gating.
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
console.log('excluded:', excluded);

// No-exclusion baseline
const { data: all, count: allCount, error: e1 } = await db
  .from('athletes')
  .select('clerk_user_id, first_name, last_name', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(0, 19);
console.log(`baseline athletes: ${allCount ?? 0}`, e1?.message ?? '');

// With exclusion
let q = db
  .from('athletes')
  .select('clerk_user_id, first_name, last_name', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(0, 19);
if (excluded.length) {
  q = q.not('clerk_user_id', 'in', `(${excluded.map(id => `"${id}"`).join(',')})`);
}
const { data, count, error } = await q;
console.log(`after exclusion: ${count ?? 0}`, error?.message ?? '');
console.log('rows:', (data ?? []).map(r => `${r.first_name} ${r.last_name} (${r.clerk_user_id})`));
