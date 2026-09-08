// scripts/inspect_schema.js
// Dumps column names, types and nullability for the project's tables, read from PostgREST's
// OpenAPI description at ${SUPABASE_URL}/rest/v1/.
//
// READ-ONLY.
//
// Why this exists: the repo checks in migrations for `ceb_bill_ingestions` and
// `ceb_bill_extractions` but not for `ceb_data` or `inverter_data_daily_summary`, so the
// shape of the two tables the dashboard actually reads lives only inside Supabase. This
// makes it inspectable — and, run alongside the row snapshot, means a snapshot captures the
// schema as well as the data.
//
// ⚠️  Nullability caveat. PostgREST's `required` list means NOT NULL *without a default*.
// A column that is NOT NULL but has a default does not appear there, so "not required" is
// strong evidence of nullability, not proof of it. The output says so per column.
//
// Usage:
//   node scripts/inspect_schema.js
//   node scripts/inspect_schema.js --out snapshot/schema.json
//   node scripts/inspect_schema.js --table inverter_data_daily_summary

import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const DEFAULT_TABLES = [
  'ceb_data',
  'ceb_bill_ingestions',
  'ceb_bill_extractions',
  'inverter_data_daily_summary',
  'inverter_data_live',
  'system_settings'
];

function parseArgs() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const tableIdx = args.indexOf('--table');
  return {
    outPath: outIdx !== -1 ? args[outIdx + 1] : null,
    only: tableIdx !== -1 ? args[tableIdx + 1] : null
  };
}

// Supabase is inconsistent about which Accept header it will serve the OpenAPI description
// for, and an anon-role key may be refused outright. Try the variants in order and report
// which one worked rather than guessing.
const ACCEPT_VARIANTS = [
  'application/openapi+json',
  'application/json',
  null // send no Accept header at all
];

async function fetchOpenApi() {
  const attempts = [];

  for (const accept of ACCEPT_VARIANTS) {
    const headers = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    };
    if (accept) headers.Accept = accept;

    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    } catch (err) {
      attempts.push(`Accept: ${accept || '(none)'} → network error: ${err.message}`);
      continue;
    }

    if (res.ok) {
      console.log(`ℹ️  OpenAPI description retrieved with Accept: ${accept || '(none)'}\n`);
      return res.json();
    }
    attempts.push(`Accept: ${accept || '(none)'} → HTTP ${res.status} ${res.statusText}`);
  }

  const err = new Error(
    'Could not retrieve the PostgREST OpenAPI description.\n' +
    attempts.map(a => `      ${a}`).join('\n') +
    '\n\n      A 401 here usually means the key is an anon key and the project does not\n' +
    '      expose the schema description to it. Fix SUPABASE_SERVICE_KEY (see\n' +
    '      docs/RECOVERY_STATUS_2026-09.md) or read the schema from the Supabase\n' +
    '      dashboard: Database → Tables → inverter_data_daily_summary.'
  );
  err.soft = true;
  throw err;
}

async function main() {
  const { outPath, only } = parseArgs();
  const tables = only ? [only] : DEFAULT_TABLES;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   SUPABASE SCHEMA (read-only)                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const spec = await fetchOpenApi();
  const defs = spec.definitions || spec.components?.schemas || {};
  const out = { inspectedAt: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    const def = defs[table];
    if (!def) {
      console.log(`⚠️  ${table} — not exposed by PostgREST (missing, or not readable)`);
      console.log('');
      out.tables[table] = { found: false };
      continue;
    }

    const required = new Set(def.required || []);
    const props = def.properties || {};

    console.log(`▸ ${table}`);
    console.log('  COLUMN                        TYPE              NULLABLE');

    const columns = {};
    for (const [name, meta] of Object.entries(props)) {
      const type = meta.format || meta.type || 'unknown';
      const isRequired = required.has(name);
      // "required" in PostgREST == NOT NULL without a default.
      const nullable = isRequired ? 'no' : 'likely yes';
      columns[name] = { type, required: isRequired, nullable };
      console.log(
        `  ${name.padEnd(29)} ${String(type).padEnd(17)} ${nullable}`
      );
    }

    out.tables[table] = { found: true, required: [...required], columns };
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('NOTE: "likely yes" means the column is absent from PostgREST\'s');
  console.log('`required` list, which covers NOT NULL columns WITHOUT a default.');
  console.log('A NOT NULL column that has a default also shows as "likely yes",');
  console.log('so treat this as strong evidence, not proof.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\n📄 Written to ${outPath}`);
  }
}

main().catch((err) => {
  console.error('💥 Schema inspection failed:', err?.message || err);
  process.exit(1);
});
