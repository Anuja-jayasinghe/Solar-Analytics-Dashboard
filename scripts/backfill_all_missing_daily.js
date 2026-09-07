// scripts/backfill_all_missing_daily.js
// Auto-detects and fills ALL missing daily summary records from inverter first generation date to yesterday.
// Compares what should exist vs what actually exists in DB, then backfills gaps.
//
// Usage:
//   node scripts/backfill_all_missing_daily.js
//   node scripts/backfill_all_missing_daily.js --dry   (preview only, no writes)
//
// Logic:
//   1. Fetch all inverters with their first generation dates.
//   2. For each inverter, generate expected date range (first gen date -> yesterday).
//   3. Query existing summary rows from DB.
//   4. Calculate missing dates = expected - existing.
//   5. Group missing dates by month and fetch from Solis API.
//   6. Upsert only missing rows.
//   7. Report detailed summary of what was added.

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js';
import 'dotenv/config';

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
  return { dry: args.includes('--dry') };
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

function groupByMonth(dates) {
  const map = new Map();
  for (const d of dates) {
    const m = monthKey(d);
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(d);
  }
  return map;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeSolisFetch(path, body, retries = 0) {
  try {
    return await solisFetch(path, body);
  } catch (err) {
    if (retries < 2) {
      const delay = (retries + 1) * 1500;
      console.warn(`⚠️  SolisFetch error: ${err.message}. Retry in ${delay}ms`);
      await sleep(delay);
      return safeSolisFetch(path, body, retries + 1);
    }
    throw err;
  }
}

// -------------------------------------------------------------
// Core Backfill
// -------------------------------------------------------------
async function backfillAllMissing() {
  const { dry } = parseArgs();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   AUTO-DETECT & BACKFILL MISSING DAILY SUMMARIES           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  if (dry) console.log('💧 Mode: DRY RUN (no writes)\n');

  const startTime = Date.now();
  
  // Yesterday in UTC (we don't backfill "today" as it's still in progress)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  
  console.log(`📅 Backfill window: [first generation date] -> ${formatDate(yesterday)}`);
  console.log('');

  // 1. Fetch inverter list
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Fetching Inverter List');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const listRes = await safeSolisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
  if (!listRes?.success || listRes?.code !== '0') {
    console.error('❌ Failed to fetch inverter list:', listRes?.msg);
    process.exit(1);
  }
  const inverters = listRes.data.page.records;
  console.log(`✅ Found ${inverters.length} inverter(s)`);
  inverters.forEach((inv, i) => {
    const firstGen = inv.fisGenerateTime ? new Date(Number(inv.fisGenerateTime)).toISOString().slice(0, 10) : 'Unknown';
    console.log(`   ${i + 1}. ${inv.sn} (First gen: ${firstGen})`);
  });
  console.log('');

  let totalMissingFound = 0;
  let totalRowsInserted = 0;
  const allAddedDates = new Map(); // inverter_sn -> array of dates

  for (const inverter of inverters) {
    const sn = inverter.sn;
    const firstGenTime = inverter.fisGenerateTime;
    
    if (!firstGenTime) {
      console.log(`⚠️  Skipping ${sn} (no first generation time)`);
      console.log('');
      continue;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`PROCESSING: ${sn}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const firstGenDate = new Date(Number(firstGenTime));
    firstGenDate.setUTCHours(0, 0, 0, 0);
    
    console.log(`📊 First generation: ${formatDate(firstGenDate)}`);
    console.log(`📊 Last date to backfill: ${formatDate(yesterday)}`);

    // 2. Generate expected dates
    const expectedDates = enumerateDatesInclusive(firstGenDate, yesterday);
    console.log(`📋 Expected summary rows: ${expectedDates.length}`);

    // 3. Query existing summary rows
    const { data: existingRows, error: existingErr } = await supabase
      .from('inverter_data_daily_summary')
      .select('summary_date')
      .eq('inverter_sn', sn)
      .gte('summary_date', formatDate(firstGenDate))
      .lte('summary_date', formatDate(yesterday));

    if (existingErr) {
      console.error(`❌ Failed to query existing summaries: ${existingErr.message}`);
      console.log('');
      continue;
    }

    const existingSet = new Set((existingRows || []).map(r => r.summary_date));
    console.log(`💾 Existing rows in DB: ${existingSet.size}`);

    // 4. Calculate missing dates
    const missingDates = expectedDates.filter(d => !existingSet.has(d));
    
    if (missingDates.length === 0) {
      console.log('✅ No missing dates! Database is complete for this inverter.');
      console.log('');
      continue;
    }

    console.log(`🔍 Missing dates found: ${missingDates.length}`);
    console.log(`   Range: ${missingDates[0]} to ${missingDates[missingDates.length - 1]}`);
    
    // Show first 10 and last 5 missing dates if many
    if (missingDates.length <= 20) {
      console.log(`   Dates: ${missingDates.join(', ')}`);
    } else {
      const preview = [
        ...missingDates.slice(0, 10),
        '...',
        ...missingDates.slice(-5)
      ];
      console.log(`   Sample: ${preview.join(', ')}`);
    }
    
    totalMissingFound += missingDates.length;

    // 5. Group missing dates by month
    const monthGroups = groupByMonth(missingDates);
    console.log(`📦 Months to fetch: ${monthGroups.size} (${Array.from(monthGroups.keys()).join(', ')})`);
    console.log('');

    // 6. Fetch month data from Solis API
    const monthDataMap = new Map(); // month => array of day records
    let fetchCount = 0;

    for (const [month, dates] of monthGroups) {
      console.log(`   ↓ Fetching ${month} (${dates.length} missing dates)...`);
      const monthRes = await safeSolisFetch('/v1/api/inverterMonth', { sn, month, money: 'USD' });
      
      if (!monthRes?.success || monthRes?.code !== '0' || !Array.isArray(monthRes.data)) {
        console.warn(`      ⚠️  Invalid response, skipping month`);
        continue;
      }
      
      monthDataMap.set(month, monthRes.data);
      console.log(`      ✓ Received ${monthRes.data.length} day records`);
      fetchCount++;
      
      // Rate limit: 1 request per second
      await sleep(1000);
    }
    
    console.log(`✅ Fetched ${fetchCount}/${monthGroups.size} months from Solis API`);
    console.log('');

    // 7. Build summary rows for missing dates
    const prepared = [];
    const addedDates = [];
    
    // Dates where Solis returned no record at all. These get a 0 kWh row, which is NOT the
    // same thing as a measured zero — see the verification block below.
    const noDataDates = [];

    for (const dateStr of missingDates) {
      const mKey = monthKey(dateStr);
      const monthArr = monthDataMap.get(mKey) || [];
      const dayRec = monthArr.find(r => r.dateStr === dateStr);

      // Solis has no record for this date. Previously we inserted a 0 kWh row here, which
      // per LR-001 is a lie: 0 means a MEASURED zero, null/absent means unavailable. A
      // fabricated zero reads as a real one on the dashboard and drags monthly averages
      // down. Leaving the row absent is the honest representation, and the alignment logic
      // already handles missing days correctly.
      if (!dayRec) {
        noDataDates.push(dateStr);
        console.warn(`   ⚠️  No Solis data for ${dateStr} — skipping (not writing a false zero)`);
        continue;
      }

      prepared.push({
        inverter_sn: sn,
        summary_date: dateStr,
        total_generation_kwh: dayRec.energy || 0,
        // NOTE: /v1/api/inverterMonth returns no peak-power field — verified 2026-09-07 by
        // dumping all 45 keys of a day record. `maxPower` is always undefined here, so this
        // resolves to 0 on every backfilled row: a claimed measured peak of 0 kW on a day
        // that generated 150+ kWh. Peak is only ever real when derived from the 5-minute
        // inverter_data_live series by functions/generate_daily_summary.
        //
        // Writing null would be the honest value, but peak_power_kw has no confirmed
        // nullable constraint (no existing row is null), so that change needs a schema
        // check first. See docs/DATA_PIPELINE_SAFEGUARDS.md.
        peak_power_kw: dayRec.maxPower || 0,
        created_at: new Date().toISOString()
      });

      addedDates.push(dateStr);
    }

    console.log(`🧮 Prepared ${prepared.length} row(s) for insertion`);

    if (dry) {
      console.log('');
      console.log('┌─ VERIFICATION ─────────────────────────────────────────────');

      // 1. What would actually be written — values, not just dates. Without this the dry
      //    run only proves which rows are missing, never that the numbers are right.
      const withData = prepared;
      const totalKwh = withData.reduce((s, r) => s + Number(r.total_generation_kwh || 0), 0);
      const peaks = withData.map(r => Number(r.peak_power_kw || 0));

      console.log(`│ Dates missing         : ${missingDates.length}`);
      console.log(`│ Rows to insert        : ${prepared.length}`);
      console.log(`│   skipped, no Solis   : ${noDataDates.length}`);
      console.log(`│ Total generation      : ${totalKwh.toFixed(2)} kWh`);
      if (withData.length > 0) {
        const avg = totalKwh / withData.length;
        console.log(`│ Mean daily generation : ${avg.toFixed(2)} kWh/day`);
        console.log(`│ Peak power range      : ${Math.min(...peaks).toFixed(2)} – ${Math.max(...peaks).toFixed(2)} kW`);
        if (Math.max(...peaks) === 0) {
          console.log('│   ⚠️  every peak is 0 — inverterMonth exposes no peak field, so');
          console.log('│      these rows will claim a measured 0 kW peak. See below.');
        }
      }
      console.log('│');

      // 2. Sample the actual values so they can be eyeballed against the Solis portal.
      const sample = withData.length <= 12
        ? withData
        : [...withData.slice(0, 6), null, ...withData.slice(-6)];
      console.log('│ Sample of values that would be written:');
      console.log('│   DATE          GENERATION      PEAK');
      for (const row of sample) {
        if (row === null) { console.log('│   ...'); continue; }
        console.log(
          `│   ${row.summary_date}  ` +
          `${String(Number(row.total_generation_kwh).toFixed(2)).padStart(9)} kWh  ` +
          `${String(Number(row.peak_power_kw).toFixed(2)).padStart(6)} kW`
        );
      }
      console.log('│');

      // 3. Sanity checks — flag anything that would poison the dashboard.
      const suspicious = withData.filter(r => Number(r.total_generation_kwh) > 500);
      const zeroButClaimedReal = withData.filter(r => Number(r.total_generation_kwh) === 0);

      if (noDataDates.length > 0) {
        console.log(`│ ℹ️  ${noDataDates.length} date(s) skipped — Solis returned no record for them.`);
        console.log('│    Left absent rather than written as 0 kWh: per LR-001 a 0 means a');
        console.log('│    MEASURED zero, and absent means unavailable.');
        const preview = noDataDates.slice(0, 10).join(', ');
        console.log(`│    ${preview}${noDataDates.length > 10 ? `, … (+${noDataDates.length - 10})` : ''}`);
        console.log('│');
      }
      if (zeroButClaimedReal.length > 0) {
        console.log(`│ ℹ️  ${zeroButClaimedReal.length} date(s) report a genuine 0 kWh from Solis.`);
        console.log('│');
      }
      if (suspicious.length > 0) {
        console.log(`│ ⚠️  ${suspicious.length} date(s) exceed 500 kWh/day — implausible for this`);
        console.log('│    system. Check the Solis response before writing.');
        console.log('│');
      }

      console.log('└────────────────────────────────────────────────────────────');
      console.log('💧 Dry run: skipping DB upsert');
      allAddedDates.set(sn, addedDates);
      console.log('');
      continue;
    }

    // 8. Upsert missing rows
    const { error: upsertErr } = await supabase
      .from('inverter_data_daily_summary')
      .upsert(prepared, { onConflict: 'inverter_sn,summary_date' });

    if (upsertErr) {
      console.error(`💥 Upsert failed: ${upsertErr.message}`);
      console.log('');
      continue;
    }

    console.log(`✅ Successfully inserted ${prepared.length} row(s) into database`);
    totalRowsInserted += prepared.length;
    allAddedDates.set(sn, addedDates);
    console.log('');
  }

  // Final summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    BACKFILL COMPLETE                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📊 Inverters processed: ${inverters.length}`);
  console.log(`🔍 Total missing dates found: ${totalMissingFound}`);
  console.log(`💾 Total rows inserted: ${dry ? 0 : totalRowsInserted}`);
  console.log(`📝 Mode: ${dry ? 'DRY RUN (no writes)' : 'WRITE'}`);
  console.log('');

  if (allAddedDates.size > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ADDED DATES BY INVERTER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [sn, dates] of allAddedDates) {
      console.log(`\n📍 ${sn}:`);
      if (dates.length <= 30) {
        console.log(`   ${dates.join(', ')}`);
      } else {
        console.log(`   First 10: ${dates.slice(0, 10).join(', ')}`);
        console.log(`   ...`);
        console.log(`   Last 10: ${dates.slice(-10).join(', ')}`);
        console.log(`   Total: ${dates.length} dates`);
      }
    }
    console.log('');
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run
backfillAllMissing().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});
