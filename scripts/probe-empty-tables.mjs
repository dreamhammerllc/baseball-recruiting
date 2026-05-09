/**
 * probe-empty-tables.mjs
 * ----------------------
 * For tables that exist but are empty, probe individual candidate column names
 * to discover the schema.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db  = createClient(url, key);

async function probe(table, candidates) {
  console.log(`\n=== ${table} columns ===`);
  for (const col of candidates) {
    const { error } = await db.from(table).select(col).limit(0);
    if (error) {
      if (
        /does not exist/i.test(error.message) ||
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST100'
      ) {
        console.log(`  ${col.padEnd(28)} : NOT PRESENT`);
      } else {
        console.log(`  ${col.padEnd(28)} : err ${error.code} ${error.message}`);
      }
    } else {
      console.log(`  ${col.padEnd(28)} : PRESENT ✓`);
    }
  }
}

await probe('coach_evaluations', [
  'id', 'coach_id', 'coach_clerk_id', 'athlete_id', 'athlete_clerk_id',
  'rating', 'overall_rating', 'score', 'stars',
  'notes', 'comments', 'evaluation_text', 'body',
  'evaluation_date', 'date',
  'is_visible_to_athlete', 'shared_with_athlete', 'is_shared', 'visible_to_athlete',
  'created_at', 'updated_at',
  'metric_key', 'metric', 'category',
  'video_url',
]);

await probe('coach_invitations', [
  'id', 'coach_id', 'coach_clerk_id',
  'athlete_id', 'athlete_clerk_id', 'athlete_email',
  'email', 'invitee_email',
  'code', 'invitation_code', 'token',
  'status', 'state',
  'expires_at', 'used_at', 'accepted_at', 'sent_at', 'created_at',
  'message',
]);
