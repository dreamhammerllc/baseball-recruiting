/**
 * probe-verification-videos.mjs
 * -----------------------------
 * READ-ONLY diagnostic. Prints all athlete_metrics rows for a target athlete
 * (Korbin Williams by default) and shows the stored `video_url` plus parsed
 * Bunny library ID / GUID. Compares against the library ID hardcoded in
 * app/profile/[username]/PublicMetricsSection.tsx (currently 653202).
 *
 * Mutates nothing. Read-only Supabase SELECTs only.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const db = createClient(url, key);

const ATHLETE_CLERK_ID = process.argv[2] ?? 'user_3Cx45lltJlEnKk4A4vGgMejEUgg'; // Korbin Williams
const HARDCODED_PLAYBACK_LIBRARY = '653202';

console.log(`Probing athlete_metrics for clerk_user_id = ${ATHLETE_CLERK_ID}`);
console.log(`Hardcoded playback library in PublicMetricsSection: ${HARDCODED_PLAYBACK_LIBRARY}\n`);

const { data, error } = await db
  .from('athlete_metrics')
  .select('id, metric_key, value, unit, verification_type, video_url, is_personal_best, created_at')
  .eq('athlete_clerk_id', ATHLETE_CLERK_ID)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('No athlete_metrics rows for this athlete.');
  process.exit(0);
}

console.log(`Found ${data.length} athlete_metrics row(s):\n`);

let mismatchCount = 0;
let withVideoCount = 0;
const librariesSeen = new Set();

for (const m of data) {
  const hasVideo = !!m.video_url;
  if (hasVideo) withVideoCount++;

  console.log(`  ${m.metric_key} = ${m.value} ${m.unit}`);
  console.log(`    verif:    ${m.verification_type}${m.is_personal_best ? '  (personal_best)' : ''}`);
  console.log(`    rowId:    ${m.id}`);
  console.log(`    video:    ${m.video_url ?? '(none)'}`);

  if (hasVideo) {
    const match = m.video_url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([\w-]+)/);
    if (match) {
      const libId = match[1];
      const guid  = match[2];
      librariesSeen.add(libId);
      const matchesPlayback = libId === HARDCODED_PLAYBACK_LIBRARY;
      console.log(`    parsed:   library=${libId}  guid=${guid}`);
      console.log(`    match:    ${matchesPlayback ? '✓ matches playback hardcode' : '✗ MISMATCH (playback uses ' + HARDCODED_PLAYBACK_LIBRARY + ')'}`);
      if (!matchesPlayback) mismatchCount++;
    } else {
      console.log(`    parsed:   (URL does not match iframe.mediadelivery.net pattern)`);
    }
  }

  console.log('');
}

console.log('─── Summary ─────────────────────────────────');
console.log(`Total rows:               ${data.length}`);
console.log(`Rows with a video_url:    ${withVideoCount}`);
console.log(`Distinct libraries seen:  ${[...librariesSeen].join(', ') || '(none)'}`);
console.log(`Hardcoded in playback:    ${HARDCODED_PLAYBACK_LIBRARY}`);
console.log(`Mismatched URLs:          ${mismatchCount}`);
