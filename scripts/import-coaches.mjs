// ============================================================
// DIAMOND VERIFIED — Coach CSV Import Script
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanEmail(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === 'Email Not On School Site') return null;
  if (trimmed === 'N/A') return null;
  if (trimmed === '') return null;
  if (!trimmed.includes('@')) return null;
  const afterAt = trimmed.split('@')[1] ?? '';
  if (!afterAt.includes('.')) {
    console.warn(`  ⚠️  Truncated email, storing NULL: "${trimmed}"`);
    return null;
  }
  return trimmed.toLowerCase();
}

function cleanPhone(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === 'N/A') return null;
  if (trimmed === '') return null;
  return trimmed;
}

function cleanText(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function schoolKey(division, name, state) {
  return `${division}|${name.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
}

async function main() {
  console.log('🚀 Diamond Verified — Coach Import Starting\n');

  const csvPath = join(__dirname, 'ncaa_baseball_coaches.csv');
  const raw = readFileSync(csvPath, 'utf-8');

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  console.log(`📋 Parsed ${rows.length} rows from CSV\n`);

  const schoolMap = new Map();
  for (const row of rows) {
    const key = schoolKey(row.Division, row.School, row.State);
    if (!schoolMap.has(key)) {
      schoolMap.set(key, {
        name: cleanText(row.School),
        division: cleanText(row.Division),
        conference: cleanText(row.Conference),
        state: cleanText(row.State),
      });
    }
  }

  console.log(`🏫 Found ${schoolMap.size} unique schools\n`);

  const schoolInserts = Array.from(schoolMap.values());

  const { data: insertedSchools, error: schoolError } = await supabase
    .from('schools')
    .upsert(schoolInserts, {
      onConflict: 'name,division,state',
      ignoreDuplicates: false,
    })
    .select('id, name, division, state');

  if (schoolError) {
    console.error('❌ School upsert failed:', schoolError);
    process.exit(1);
  }

  const schoolIdLookup = new Map();
  for (const school of insertedSchools) {
    const key = schoolKey(school.division, school.name, school.state);
    schoolIdLookup.set(key, school.id);
  }

  console.log(`✅ Schools upserted: ${insertedSchools.length}\n`);

  const coachRows = [];
  const skipped = [];

  for (const row of rows) {
    const name = cleanText(row.Coach);
    if (!name) {
      skipped.push({ row, reason: 'Missing coach name' });
      continue;
    }

    const key = schoolKey(row.Division, row.School, row.State);
    const schoolId = schoolIdLookup.get(key) ?? null;

    if (!schoolId) {
      console.warn(`  ⚠️  No school ID for: ${row.School} (${row.Division}, ${row.State})`);
    }

    coachRows.push({
      school_id: schoolId,
      full_name: name,
      title: cleanText(row.Title),
      email: cleanEmail(row.Email),
      phone: cleanPhone(row.Phone),
      division: cleanText(row.Division),
      conference: cleanText(row.Conference),
      state: cleanText(row.State),
      is_registered: false,
    });
  }

  console.log(`👤 Coaches to insert: ${coachRows.length}`);
  console.log(`⏭️  Rows skipped: ${skipped.length}\n`);

  const BATCH_SIZE = 100;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < coachRows.length; i += BATCH_SIZE) {
    const batch = coachRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(coachRows.length / BATCH_SIZE);

    const { error } = await supabase
      .from('college_coaches')
      .upsert(batch, {
        onConflict: 'full_name,school_id',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
      failed += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} complete (${inserted} inserted)`);
    }
  }

  console.log('\n');
  console.log('════════════════════════════════════════');
  console.log('✅ Import Complete');
  console.log(`   Schools:  ${insertedSchools.length}`);
  console.log(`   Coaches:  ${inserted} inserted, ${failed} failed`);
  console.log(`   Skipped:  ${skipped.length} rows`);
  console.log('════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
