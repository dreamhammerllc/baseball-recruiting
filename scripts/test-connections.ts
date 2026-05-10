/**
 * Diagnostic script — run with: npx tsx scripts/test-connections.ts
 * Bypasses Next.js / Clerk and hits Supabase directly with the service role key.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COACH_ID     = 'user_3CeNKQl5i4CqZ16CRSShGV2zGKR';

console.log('=== ENV CHECK ===');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SERVICE_KEY starts with:', SERVICE_KEY?.slice(0, 20));
console.log('');

async function run() {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Query 1: coach_athlete_connections ─────────────────────────────────
    console.log('=== QUERY 1: coach_athlete_connections ===');
    const { data: connections, error: connError } = await supabase
      .from('coach_athlete_connections')
      .select('id, athlete_id, connected_at')
      .eq('coach_id', COACH_ID);

    console.log('CONN_ERROR:', JSON.stringify(connError, null, 2));
    console.log('CONNECTIONS:', JSON.stringify(connections, null, 2));
    console.log('connections count:', connections?.length ?? 0);
    console.log('');

    if (!connections || connections.length === 0) {
      console.log('No connections found — skipping athlete query.');
      return;
    }

    // ── Query 2: athletes ──────────────────────────────────────────────────
    const athleteIds = connections.map((c: { athlete_id: string }) => c.athlete_id);
    console.log('=== QUERY 2: athletes ===');
    console.log('Looking up athleteIds:', athleteIds);

    const { data: profiles, error: profileError } = await supabase
      .from('athletes')
      .select('clerk_user_id, full_name, first_name, last_name, username, position, photo_url, grad_year')
      .in('clerk_user_id', athleteIds);

    console.log('PROFILE_ERROR:', JSON.stringify(profileError, null, 2));
    console.log('PROFILES:', JSON.stringify(profiles, null, 2));
    console.log('profiles count:', profiles?.length ?? 0);

  } catch (e: unknown) {
    const err = e as Error;
    console.error('THROWN ERROR:', err.message);
    console.error('STACK:', err.stack);
  }
}

run();
