/**
 * probe-video-url-hosts.mjs
 * -------------------------
 * READ-ONLY. Counts athlete_metrics rows by video_url host family, to size
 * the migration scope from Bunny -> Vercel Blob.
 *
 * Buckets:
 *   - iframe.mediadelivery.net (Bunny Stream embed)
 *   - vz-*.b-cdn.net           (Bunny Stream pull-zone direct MP4)
 *   - public.blob.vercel-storage.com (Vercel Blob)
 *   - diamond-verified-cdn.b-cdn.net (Bunny Storage zone direct)
 *   - (none) / (other)
 *
 * Mutates nothing. SELECTs only.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) { console.error('Missing env'); process.exit(1); }
const db = createClient(url, key);

function bucketFor(url) {
  if (!url) return '(none)';
  if (url.includes('iframe.mediadelivery.net'))           return 'bunny_stream_iframe';
  if (/^https:\/\/vz-[^/]+\.b-cdn\.net\//.test(url))       return 'bunny_stream_pullzone_direct';
  if (url.includes('public.blob.vercel-storage.com'))      return 'vercel_blob';
  if (url.includes('diamond-verified-cdn.b-cdn.net'))      return 'bunny_storage_direct';
  if (url.includes('b-cdn.net'))                           return 'bunny_other_b_cdn';
  if (url.includes('youtube'))                             return 'youtube';
  return '(other)';
}

console.log('=== athlete_metrics — video_url host breakdown ===\n');

const { data, error } = await db
  .from('athlete_metrics')
  .select('id, video_url, verification_type, is_personal_best, athlete_clerk_id');

if (error) { console.error(error.message); process.exit(1); }

const counts = new Map();
const samplesByBucket = new Map();
let total = 0, withVideo = 0;

for (const r of data ?? []) {
  total++;
  const b = bucketFor(r.video_url);
  counts.set(b, (counts.get(b) ?? 0) + 1);
  if (r.video_url) {
    withVideo++;
    if (!samplesByBucket.has(b)) samplesByBucket.set(b, r.video_url);
  }
}

console.log(`Total athlete_metrics rows: ${total}`);
console.log(`Rows with a video_url:      ${withVideo}\n`);

const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [bucket, n] of ordered) {
  console.log(`  ${bucket.padEnd(32)} ${String(n).padStart(4)}`);
  if (samplesByBucket.has(bucket)) {
    console.log(`    sample: ${samplesByBucket.get(bucket).slice(0, 100)}`);
  }
}

console.log('\n=== coach_verifications — video_url host breakdown ===\n');

const { data: cv, error: cvErr } = await db
  .from('coach_verifications')
  .select('id, video_url');

if (cvErr) { console.error(cvErr.message); process.exit(1); }

const cvCounts = new Map();
const cvSamples = new Map();
let cvTotal = 0, cvWithVideo = 0;
for (const r of cv ?? []) {
  cvTotal++;
  const b = bucketFor(r.video_url);
  cvCounts.set(b, (cvCounts.get(b) ?? 0) + 1);
  if (r.video_url) {
    cvWithVideo++;
    if (!cvSamples.has(b)) cvSamples.set(b, r.video_url);
  }
}
console.log(`Total coach_verifications rows: ${cvTotal}`);
console.log(`Rows with a video_url:          ${cvWithVideo}\n`);
for (const [bucket, n] of [...cvCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${bucket.padEnd(32)} ${String(n).padStart(4)}`);
  if (cvSamples.has(bucket)) {
    console.log(`    sample: ${cvSamples.get(bucket).slice(0, 100)}`);
  }
}
