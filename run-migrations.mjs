/**
 * run-migrations.mjs
 * ------------------
 * Runs phase8_metrics.sql against the Supabase project.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=<your-db-password> node run-migrations.mjs
 *
 * The DB password is shown in: Supabase Dashboard → Project Settings → Database
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

// ── Option A: attempt via Management API if SUPABASE_ACCESS_TOKEN is set ──────
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'jgtjrlncbskcihhqjvbt';
const sql = readFileSync('./supabase/migrations/phase8_metrics.sql', 'utf8');

// Strip comment lines first, then split into individual statements
const statements = sql
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

if (PAT) {
  console.log('Found SUPABASE_ACCESS_TOKEN — trying Management API...');
  for (const stmt of statements) {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: stmt }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Statement failed:', json);
      process.exit(1);
    }
    console.log('OK:', stmt.slice(0, 60).replace(/\n/g, ' '));
  }
  console.log('\nAll migrations complete.');
  process.exit(0);
}

// ── Option B: direct pg connection ────────────────────────────────────────────
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error(`
No credentials found. Provide one of:

  Option 1 — Supabase Personal Access Token (from supabase.com/dashboard/account/tokens):
    SUPABASE_ACCESS_TOKEN=sbp_... node run-migrations.mjs

  Option 2 — Database password (from Project Settings > Database in your Supabase dashboard):
    SUPABASE_DB_PASSWORD=your-password node run-migrations.mjs

The SQL to run is in: supabase/migrations/phase8_metrics.sql
You can also paste it directly in the Supabase SQL Editor at:
  https://app.supabase.com/project/jgtjrlncbskcihhqjvbt/sql/new
`);
  process.exit(1);
}

// Dynamically import pg (install if missing)
let pg;
try {
  pg = await import('pg');
} catch {
  console.log('Installing pg driver...');
  const { execSync } = await import('child_process');
  execSync('npm install pg', { stdio: 'inherit' });
  pg = await import('pg');
}

const { default: { Client } } = pg;

const client = new Client({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL directly.');

  for (const stmt of statements) {
    await client.query(stmt);
    console.log('OK:', stmt.slice(0, 60).replace(/\n/g, ' '));
  }

  // Verify
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('athlete_positions','metric_sessions','athlete_metrics','highlight_videos')
     ORDER BY table_name`
  );
  console.log('\nTables confirmed in database:');
  result.rows.forEach(r => console.log(' ✓', r.table_name));
  console.log('\nAll migrations complete.');
} finally {
  await client.end();
}
