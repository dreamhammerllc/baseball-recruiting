/**
 * fetch-openapi.mjs
 * -----------------
 * PostgREST exposes a full OpenAPI doc at /rest/v1/. Use it to read column shapes
 * for every table (including empty ones) without guessing.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});

if (!res.ok) {
  console.error('Failed:', res.status, await res.text());
  process.exit(1);
}

const spec = await res.json();
const TABLES = ['saved_athletes', 'coach_evaluations', 'coach_invitations'];

for (const t of TABLES) {
  console.log(`\n=== ${t} ===`);
  const def = spec.definitions?.[t];
  if (!def) {
    console.log('  (not in OpenAPI spec)');
    continue;
  }
  const props = def.properties ?? {};
  const required = new Set(def.required ?? []);
  for (const [name, schema] of Object.entries(props)) {
    const req = required.has(name) ? '*' : ' ';
    const type = schema.format ?? schema.type ?? '?';
    const def_ = schema.default !== undefined ? `  default ${JSON.stringify(schema.default)}` : '';
    const desc = schema.description ? `  // ${schema.description.slice(0, 80)}` : '';
    console.log(`  ${req} ${name.padEnd(28)} ${type}${def_}${desc}`);
  }
}
