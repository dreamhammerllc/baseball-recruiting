/**
 * test-video-parser.mjs
 * ---------------------
 * Standalone parity-check for the parseVideoUrl logic in
 * components/profile/VideoPlayer.tsx — kept inline here so this file
 * has no module deps. If the cases below break, fix VideoPlayer.tsx too.
 */

function parseVideoUrl(url) {
  if (!url) return null;
  if (url.includes('iframe.mediadelivery.net')) {
    const id = url.split('/').pop()?.split('?')[0] ?? '';
    return id ? { provider: 'bunny', id } : null;
  }
  if (url.includes('vz-d9ee7f6e-2b7.b-cdn.net')) {
    const id = url.split('/')[3] ?? '';
    return id ? { provider: 'bunny', id } : null;
  }
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? { provider: 'youtube', id } : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return { provider: 'youtube', id: v };
      const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/);
      if (m) return { provider: 'youtube', id: m[1] };
    }
  } catch {}
  return null;
}

const cases = [
  // [url, expected.provider, expected.id]
  ['https://youtu.be/eY1vtqrrHJA?si=eed7d14_2prDaQNt',                      'youtube', 'eY1vtqrrHJA'],
  ['https://www.youtube.com/watch?v=eY1vtqrrHJA',                            'youtube', 'eY1vtqrrHJA'],
  ['https://youtube.com/watch?v=eY1vtqrrHJA&feature=share',                  'youtube', 'eY1vtqrrHJA'],
  ['https://www.youtube.com/embed/eY1vtqrrHJA',                              'youtube', 'eY1vtqrrHJA'],
  ['https://www.youtube.com/shorts/eY1vtqrrHJA',                             'youtube', 'eY1vtqrrHJA'],
  ['https://m.youtube.com/watch?v=eY1vtqrrHJA',                              'youtube', 'eY1vtqrrHJA'],
  ['https://iframe.mediadelivery.net/embed/653202/abc-123',                  'bunny',   'abc-123'],
  ['https://iframe.mediadelivery.net/embed/653202/abc-123?autoplay=true',    'bunny',   'abc-123'],
  ['https://vz-d9ee7f6e-2b7.b-cdn.net/abc-123/playlist.m3u8',                'bunny',   'abc-123'],
  ['',                                                                        null,      null],
  ['not a url',                                                               null,      null],
  ['https://vimeo.com/12345',                                                 null,      null],
];

let pass = 0, fail = 0;
for (const [url, expProvider, expId] of cases) {
  const got = parseVideoUrl(url);
  const ok = expProvider === null
    ? got === null
    : got?.provider === expProvider && got?.id === expId;
  if (ok) {
    pass++;
    console.log(`  ✓ ${url.slice(0, 60).padEnd(60)}  →  ${got ? `${got.provider}:${got.id}` : 'null'}`);
  } else {
    fail++;
    console.log(`  ✗ ${url.slice(0, 60).padEnd(60)}  expected ${expProvider}:${expId}  got ${got ? `${got.provider}:${got.id}` : 'null'}`);
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
