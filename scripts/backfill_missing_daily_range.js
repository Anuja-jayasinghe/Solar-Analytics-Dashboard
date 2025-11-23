// scripts/backfill_missing_daily_range.js
// One-time backfill for missing daily summary rows between a start and end date.
// Uses SolisCloud historical month endpoint so it does NOT rely on past live polling.
// Safe to re-run: only inserts rows that are currently missing.
//
// Usage (Windows cmd):
//   set SUPABASE_URL=YOUR_URL
//   set SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY
//   node scripts/backfill_missing_daily_range.js --start 2025-11-15 --end 2025-11-22
//
// CLI Options:
//   --start YYYY-MM-DD   (required)
//   --end   YYYY-MM-DD   (required)
//   --dry                (no DB writes, just report)
//
// Logic:
//   1. Parse date range (inclusive).
//   2. Fetch inverter list.
//   3. For each inverter, query existing summary rows in range.
//   4. Build set of missing dates.
//   5. Fetch month data (Solis /v1/api/inverterMonth) for each month overlapping range.
//   6. Map API daily records -> missing dates; prepare summary rows.
//   7. Upsert only missing dates.
//   8. Report counts & anomalies.

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js';
import 'dotenv/config';

console.log('🔧 Script starting...');
console.log('ENV check: SUPABASE_URL =', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('ENV check: SUPABASE_SERVICE_KEY =', process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--start') opts.start = args[++i];
    else if (a === '--end') opts.end = args[++i];
    else if (a === '--dry') opts.dry = true;
  }
  if (!opts.start || !opts.end) {
    console.error('❌ Missing --start or --end. Example: --start 2025-11-15 --end 2025-11-22');
    process.exit(1);
  }
  return opts;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)); // treat as UTC date boundary
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function enumerateDatesInclusive(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate.getTime());
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeSolisFetch(path, body, retries = 0) {
  try {
    return await solisFetch(path, body);
  } catch (err) {
    if (retries < 2) {
      const delay = (retries + 1) * 1500;
      console.warn(`⚠️ SolisFetch error: ${err.message}. Retry in ${delay}ms`);
      await sleep(delay);
      return safeSolisFetch(path, body, retries + 1);
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Core Backfill
// -------------------------------------------------------------
async function backfillRange() {
  const { start, end, dry } = parseArgs();
  console.log('\n══════════════════════════════════════════════');
  console.log(' DAILY SUMMARY RANGE BACKFILL');
  console.log('══════════════════════════════════════════════');
  console.log(`📅 Range: ${start} -> ${end} (inclusive)`);
  if (dry) console.log('💧 Mode: DRY RUN (no writes)');

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (endDate < startDate) {
    console.error('❌ End date before start date.');
    process.exit(1);
  }
  const allDates = enumerateDatesInclusive(startDate, endDate);
  console.log(`🗓 Total days in range: ${allDates.length}`);

  // 1. Fetch inverter list
  console.log('📡 Fetching inverter list...');
  const listRes = await safeSolisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
  if (!listRes?.success || listRes?.code !== '0') {
    console.error('❌ Failed to fetch inverter list:', listRes?.msg);
    process.exit(1);
  }
  const inverters = listRes.data.page.records;
  console.log(`🔌 Inverters found: ${inverters.length}`);

  let totalRowsPrepared = 0;
  let totalRowsInserted = 0;

  // Pre-group dates by month for fewer API calls
  const monthsInRange = [...new Set(allDates.map(monthKey))];
  console.log(`🧩 Months involved: ${monthsInRange.join(', ')}`);

  for (const inverter of inverters) {
    const sn = inverter.sn;
    console.log(`\n--- Processing inverter ${sn} ---`);
    // 2. Query existing summary rows for this inverter in range
    const { data: existingRows, error: existingErr } = await supabase
      .from('inverter_data_daily_summary')
      .select('summary_date')
      .eq('inverter_sn', sn)
      .gte('summary_date', start)
      .lte('summary_date', end);
    if (existingErr) {
      console.error(`❌ Failed to query existing summaries: ${existingErr.message}`);
      continue;
    }

    const existingSet = new Set((existingRows || []).map(r => r.summary_date));
    const missingDates = allDates.filter(d => !existingSet.has(d));
    if (missingDates.length === 0) {
      console.log('✅ No missing dates for this inverter.');
      continue;
    }
    console.log(`🔍 Missing dates (${missingDates.length}): ${missingDates.join(', ')}`);

    // 3. Fetch month data only for months containing missing dates
    const missingMonths = [...new Set(missingDates.map(monthKey))];
    const monthDataMap = new Map(); // month => array of day records

    for (const m of missingMonths) {
      console.log(`📦 Fetching month ${m} from Solis API...`);
      const monthRes = await safeSolisFetch('/v1/api/inverterMonth', { sn, month: m, money: 'USD' });
      if (!monthRes?.success || monthRes?.code !== '0' || !Array.isArray(monthRes.data)) {
        console.warn(`⚠️ Skipping month ${m} (invalid response)`);
        continue;
      }
      monthDataMap.set(m, monthRes.data);
      // Rate limit
      await sleep(1000);
    }

    // 4. Build summary rows for missing dates
    const prepared = [];
    for (const dateStr of missingDates) {
      const mKey = monthKey(dateStr);
      const monthArr = monthDataMap.get(mKey) || [];
      const dayRec = monthArr.find(r => r.dateStr === dateStr);
      if (!dayRec) {
        console.warn(`⚠️ No Solis data for ${dateStr}; inserting zero row.`);
      }
      prepared.push({
        inverter_sn: sn,
        summary_date: dateStr,
        total_generation_kwh: dayRec?.energy || 0,
        peak_power_kw: dayRec?.maxPower || 0,
        created_at: new Date().toISOString()
      });
    }

    console.log(`🧮 Prepared ${prepared.length} row(s) for inverter ${sn}.`);
    totalRowsPrepared += prepared.length;

    if (dry) {
      console.log('💧 Dry run: skipping DB upsert.');
      continue;
    }

    // 5. Upsert missing rows only
    const { error: upsertErr } = await supabase
      .from('inverter_data_daily_summary')
      .upsert(prepared, { onConflict: 'inverter_sn,summary_date' });
    if (upsertErr) {
      console.error(`💥 Upsert failed for inverter ${sn}: ${upsertErr.message}`);
      continue;
    }
    console.log(`✅ Inserted/updated ${prepared.length} row(s).`);
    totalRowsInserted += prepared.length;
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(' BACKFILL COMPLETE');
  console.log(` 📝 Rows prepared: ${totalRowsPrepared}`);
  console.log(` 💾 Rows inserted: ${dry ? 0 : totalRowsInserted}`);
  console.log(` Mode: ${dry ? 'DRY (no writes)' : 'WRITE'}`);
  console.log('══════════════════════════════════════════════\n');
}

// Run if executed directly
backfillRange().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
