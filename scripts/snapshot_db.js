// scripts/snapshot_db.js
// Exports the project's Supabase tables to JSON files — a restore point to take before any
// operation that writes to the database (backfills, migrations, bulk approvals).
//
// READ-ONLY. This script never writes to Supabase.
//
// ⚠️  IMPORTANT — this is a safety net, not an authoritative backup.
//
// It can only capture what the configured key is allowed to SELECT. If SUPABASE_SERVICE_KEY
// holds an anon key (see docs/RECOVERY_STATUS_2026-09.md), row-level security silently
// filters rows out and an RLS-blocked table comes back as an empty array rather than an
// error — a snapshot that looks fine and contains nothing.
//
// To guard against exactly that, tables listed in REQUIRED_NON_EMPTY below must return rows
// or the run FAILS. A snapshot that captured nothing is not a snapshot.
//
// For a real point-in-time backup, use Supabase's own: Dashboard → Database → Backups.
//
// Usage:
//   node scripts/snapshot_db.js
//   node scripts/snapshot_db.js --out ./snapshot
//   SNAPSHOT_TABLES=ceb_data,system_settings node scripts/snapshot_db.js

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DEFAULT_TABLES = [
  'ceb_data',
  'ceb_bill_ingestions',
  'ceb_bill_extractions',
  'inverter_data_daily_summary',
  'inverter_data_live',
  'system_settings'
];

// If any of these come back empty, the snapshot is not trustworthy and the run fails.
// `inverter_data_live` is deliberately NOT here — it is legitimately empty right now.
const REQUIRED_NON_EMPTY = ['ceb_data', 'inverter_data_daily_summary', 'system_settings'];

const PAGE_SIZE = 1000;

function parseArgs() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  return { outDir: outIdx !== -1 ? args[outIdx + 1] : 'snapshot' };
}

async function dumpTable(table) {
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { table, ok: false, rowCount: 0, error: error.message };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { table, ok: true, rowCount: rows.length, rows };
}

async function main() {
  const { outDir } = parseArgs();
  const tables = (process.env.SNAPSHOT_TABLES || DEFAULT_TABLES.join(','))
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const takenAt = new Date().toISOString();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   SUPABASE SNAPSHOT (read-only)                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`🕐 Taken at : ${takenAt}`);
  console.log(`📁 Output   : ${path.resolve(outDir)}`);
  console.log(`📋 Tables   : ${tables.join(', ')}`);
  console.log('');

  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const table of tables) {
    process.stdout.write(`   ↓ ${table.padEnd(30)}`);
    const result = await dumpTable(table);

    if (result.ok) {
      fs.writeFileSync(
        path.join(outDir, `${table}.json`),
        JSON.stringify(result.rows, null, 2)
      );
      console.log(`${String(result.rowCount).padStart(7)} row(s)`);
    } else {
      console.log(`  ERROR — ${result.error}`);
    }

    results.push({
      table: result.table,
      ok: result.ok,
      rowCount: result.rowCount,
      error: result.error || null
    });
  }

  const manifest = {
    takenAt,
    supabaseUrl: SUPABASE_URL,
    tables: results,
    totalRows: results.reduce((sum, r) => sum + r.rowCount, 0),
    note: 'Captured with the configured key only. RLS-filtered rows are silently absent. ' +
          'For an authoritative backup use Supabase Dashboard → Database → Backups.'
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📦 Total rows captured: ${manifest.totalRows}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // -----------------------------------------------------------------
  // Trust checks. An empty snapshot must never look like a successful one.
  // -----------------------------------------------------------------
  const failed = results.filter(r => !r.ok);
  const suspiciouslyEmpty = results.filter(
    r => r.ok && r.rowCount === 0 && REQUIRED_NON_EMPTY.includes(r.table)
  );

  for (const r of results.filter(r => r.ok && r.rowCount === 0)) {
    const required = REQUIRED_NON_EMPTY.includes(r.table);
    console.log(`${required ? '❌' : 'ℹ️ '} ${r.table} returned 0 rows` +
      (required ? ' — expected to contain data' : ' (expected to be empty right now)'));
  }

  if (failed.length > 0 || suspiciouslyEmpty.length > 0) {
    console.log('');
    console.log('❌ SNAPSHOT NOT TRUSTWORTHY — do not treat this as a restore point.');
    if (failed.length > 0) {
      console.log(`   Query errors    : ${failed.map(r => r.table).join(', ')}`);
    }
    if (suspiciouslyEmpty.length > 0) {
      console.log(`   Unexpectedly empty: ${suspiciouslyEmpty.map(r => r.table).join(', ')}`);
      console.log('   A table that exists but returns nothing usually means row-level');
      console.log('   security filtered it out — i.e. SUPABASE_SERVICE_KEY is not a');
      console.log('   service_role key. See docs/RECOVERY_STATUS_2026-09.md.');
    }
    process.exit(1);
  }

  console.log('✅ Snapshot complete and non-empty across all required tables.');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Snapshot crashed:', err?.message || err);
  process.exit(1);
});
