/**
 * head-check-videos.mjs
 * ---------------------
 * READ-ONLY diagnostic. For Korbin's two coach-verified Bunny pull-zone URLs,
 * perform HEAD requests against the stored path plus likely transcode variants.
 * Reports status, content-type, content-length per URL.
 *
 * Mutates nothing. No DB access. Pure outbound HTTP HEAD probes.
 */

const BASE_URLS = [
  ['slider_velocity',   'https://vz-d9ee7f6e-2b7.b-cdn.net/12f5e575-a961-4607-8e95-5cb64b1c9f57'],
  ['sixty_yard_dash',   'https://vz-d9ee7f6e-2b7.b-cdn.net/afc43d06-246f-447f-9099-ca31889ad428'],
];

const VARIANTS = [
  'play_720p.mp4',  // stored variant
  'play_480p.mp4',
  'play_360p.mp4',
  'play_240p.mp4',
  'play.mp4',
  'playlist.m3u8',
];

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    return {
      status: res.status,
      type:   res.headers.get('content-type'),
      size:   res.headers.get('content-length'),
      location: res.headers.get('location'),
    };
  } catch (err) {
    return { error: err.message };
  }
}

for (const [label, base] of BASE_URLS) {
  console.log(`\n=== ${label} ===`);
  console.log(`Base: ${base}`);
  for (const variant of VARIANTS) {
    const url = `${base}/${variant}`;
    const r = await head(url);
    const tag = r.error
      ? `ERR ${r.error}`
      : `${r.status}  type=${r.type ?? '-'}  size=${r.size ?? '-'}${r.location ? '  loc=' + r.location : ''}`;
    console.log(`  /${variant.padEnd(15)}  ${tag}`);
  }
}
