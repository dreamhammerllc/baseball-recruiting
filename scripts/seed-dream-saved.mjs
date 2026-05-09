/**
 * seed-dream-saved.mjs
 * --------------------
 * Saves a few seeded athletes to Dream's coach watchlist so the Saved page
 * has content to render. Idempotent — uses upsert on (coach_id, athlete_clerk_id).
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

const DREAM_CLERK = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';

// Resolve Dream's internal coach.id (saved_athletes.coach_id is uuid, not clerk_user_id).
const { data: coachRow, error: coachErr } = await db
  .from('coaches')
  .select('id')
  .eq('clerk_user_id', DREAM_CLERK)
  .maybeSingle();
if (coachErr || !coachRow) {
  console.error('Could not resolve coach:', coachErr ?? '(no row)');
  process.exit(1);
}
console.log(`Dream's internal coach.id: ${coachRow.id}`);

// Pick a curated mix from the seeded athletes
const TO_SAVE = [
  'seed_test_01', // Jake Carter   — pitcher, CA, verified
  'seed_test_07', // Jaden Rivers  — CF, CA, verified, exit 95
  'seed_test_14', // Ryan Park     — SS, CA, GPA 4.0, verified
  'seed_test_24', // Asher Klein   — DH, PA, verified, exit 105
];

// Stagger saved_at so "Recently Saved" is meaningful.
const now = Date.now();
const day = (n) => new Date(now - n * 86400000).toISOString();

// Pull the snapshot fields the existing schema requires (athlete_name etc).
const { data: athletes } = await db
  .from('athletes')
  .select('clerk_user_id, first_name, last_name, photo_url, username')
  .in('clerk_user_id', TO_SAVE);

const byId = new Map((athletes ?? []).map(a => [a.clerk_user_id, a]));

const rows = TO_SAVE.map((id, i) => {
  const a = byId.get(id);
  if (!a) throw new Error(`Athlete ${id} not in DB — run seed-discover-athletes.mjs first.`);
  return {
    coach_id:         coachRow.id,
    athlete_clerk_id: id,
    athlete_name:     `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(),
    athlete_photo:    a.photo_url,
    athlete_username: a.username,
    saved_at:         day(i),
  };
});

const { data, error } = await db
  .from('saved_athletes')
  .upsert(rows, { onConflict: 'coach_id,athlete_clerk_id' })
  .select('athlete_clerk_id, saved_at');

if (error) {
  console.error('UPSERT FAILED:', error);
  process.exit(1);
}

console.log(`OK — ${data?.length ?? 0} saved entries.`);
console.log(data);
