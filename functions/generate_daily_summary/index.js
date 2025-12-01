// Daily Inverter Summary Generator
// Aggregates live inverter data into daily summaries (total generation & peak power)
// Runs daily at 22:30 Sri Lanka time (17:00 UTC)
// Features:
// - Backfills last 30 days of missing or incomplete summaries
// - Updates records if new data is available
// - Prevents updating today's record before 23:00 local time

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// =============================================================
// CONFIGURATION & ENV VALIDATION
// =============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables for Supabase');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Timezone offset for Sri Lanka (UTC+5:30) in minutes
const SRI_LANKA_OFFSET_MINUTES = 5 * 60 + 30;

// Number of days to backfill/check on each run
const BACKFILL_DAYS = 30;

// Minimum hour (24h format) to allow updating today's record (23 = 11 PM)
const MIN_HOUR_FOR_TODAY_UPDATE = 23;

// =============================================================
// UTILS
// =============================================================
function getColomboDateParts(date = new Date()) {
  // Use Intl to get local date components in Asia/Colombo
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function formatDateYYYYMMDD({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getUTCWindowForLocalDay(parts) {
  // Start of local day (00:00 Asia/Colombo) converted to UTC by subtracting offset
  const startLocal = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0); // milliseconds
  const endLocal = Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);
  const startUTC = new Date(startLocal - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);
  const endUTC = new Date(endLocal - SRI_LANKA_OFFSET_MINUTES * 60 * 1000);
  return { startUTC, endUTC };
}

function round2(value) {
  return Number.parseFloat((value ?? 0).toFixed(2));
}

function getColomboTime() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    hour12: false
  });
  const hourStr = formatter.format(new Date());
  return parseInt(hourStr, 10);
}

function getDateDaysAgo(daysAgo) {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return getColomboDateParts(date);
}

// =============================================================
// CORE LOGIC
// =============================================================
async function processSingleDay(dateParts) {
  const summaryDate = formatDateYYYYMMDD(dateParts);
  const { startUTC, endUTC } = getUTCWindowForLocalDay(dateParts);

  // Fetch live data rows within the local day window
  console.log(`   🔍 Fetching live data from ${startUTC.toISOString()} to ${endUTC.toISOString()}`);
  const { data: liveRows, error: liveErr } = await supabase
    .from('inverter_data_live')
    .select('inverter_sn,power_ac,generation_today,data_timestamp')
    .gte('data_timestamp', startUTC.toISOString())
    .lte('data_timestamp', endUTC.toISOString());

  if (liveErr) throw new Error(`Failed to fetch live data for ${summaryDate}: ${liveErr.message}`);
  if (!liveRows || liveRows.length === 0) {
    console.log(`   ⚠️  No live data rows found`);
    return { summaryDate, action: 'skipped', reason: 'no_live_data', inverters: [] };
  }

  console.log(`   📥 Fetched ${liveRows.length} live data rows`);
  
  // Check if data is sufficient (at least 1 rows for a full day)
  const MIN_ROWS_FOR_FULL_DAY = 1;
  const hasInsufficientData = liveRows.length < MIN_ROWS_FOR_FULL_DAY;
  if (hasInsufficientData) {
    console.log(`   ⚠️  Insufficient data (${liveRows.length} rows < ${MIN_ROWS_FOR_FULL_DAY} minimum)`);
    console.log(`   ℹ️  Live data may have been pruned - will not update existing records`);
  }
  
  // Log sample of fetched data (first 3 rows)
  if (liveRows.length > 0) {
    const sampleSize = Math.min(3, liveRows.length);
    console.log(`   📋 Sample data (showing ${sampleSize} of ${liveRows.length}):`);
    liveRows.slice(0, sampleSize).forEach(row => {
      console.log(`      • ${row.inverter_sn} @ ${row.data_timestamp}: gen=${row.generation_today} kWh, power=${row.power_ac} kW`);
    });
  }

  // Aggregate per inverter
  const inverterMap = new Map();
  for (const row of liveRows) {
    const key = row.inverter_sn;
    if (!inverterMap.has(key)) {
      inverterMap.set(key, {
        inverter_sn: key,
        maxGenerationToday: 0,
        maxPowerAc: 0
      });
    }
    const agg = inverterMap.get(key);
    if (typeof row.generation_today === 'number' && row.generation_today > agg.maxGenerationToday) {
      agg.maxGenerationToday = row.generation_today;
    }
    if (typeof row.power_ac === 'number' && row.power_ac > agg.maxPowerAc) {
      agg.maxPowerAc = row.power_ac;
    }
  }

  const summaryRows = Array.from(inverterMap.values()).map(r => ({
    inverter_sn: r.inverter_sn,
    summary_date: summaryDate,
    total_generation_kwh: round2(r.maxGenerationToday),
    peak_power_kw: round2(r.maxPowerAc)
  }));

  // Check existing records
  console.log(`   🔎 Checking existing summary records for ${summaryDate}...`);
  const { data: existingRecords, error: fetchErr } = await supabase
    .from('inverter_data_daily_summary')
    .select('inverter_sn, total_generation_kwh, peak_power_kw')
    .eq('summary_date', summaryDate);

  if (fetchErr) throw new Error(`Failed to fetch existing records for ${summaryDate}: ${fetchErr.message}`);

  const existingMap = new Map();
  if (existingRecords && existingRecords.length > 0) {
    console.log(`   📊 Found ${existingRecords.length} existing record(s):`);
    existingRecords.forEach(r => {
      existingMap.set(r.inverter_sn, r);
      console.log(`      • ${r.inverter_sn}: gen=${r.total_generation_kwh} kWh, peak=${r.peak_power_kw} kW`);
    });
  } else {
    console.log(`   ℹ️  No existing records found (will insert new)`);
  }

  const actions = [];
  console.log(`   🔄 Comparing calculated vs existing values...`);
  for (const newRow of summaryRows) {
    const existing = existingMap.get(newRow.inverter_sn);
    if (!existing) {
      console.log(`      ➕ ${newRow.inverter_sn}: NEW RECORD (gen=${newRow.total_generation_kwh} kWh, peak=${newRow.peak_power_kw} kW)`);
      actions.push({ inverter: newRow.inverter_sn, action: 'insert', data: newRow });
    } else {
      // If data is insufficient, skip updating existing records to prevent data loss
      if (hasInsufficientData) {
        console.log(`      ⏭️  ${newRow.inverter_sn}: SKIPPED (insufficient live data - preserving existing record)`);
        actions.push({ inverter: newRow.inverter_sn, action: 'skipped_insufficient_data' });
        continue;
      }
      
      // Check if values differ (update needed)
      const genChanged = Math.abs(existing.total_generation_kwh - newRow.total_generation_kwh) > 0.01;
      const peakChanged = Math.abs((existing.peak_power_kw || 0) - newRow.peak_power_kw) > 0.01;
      
      // Additional safety check: don't update if new peak is significantly lower (likely incomplete data)
      const peakDroppedSignificantly = (existing.peak_power_kw || 0) - newRow.peak_power_kw > 5.0;
      
      if (genChanged || peakChanged) {
        if (peakDroppedSignificantly) {
          console.log(`      ⚠️  ${newRow.inverter_sn}: UPDATE BLOCKED (peak dropped by ${((existing.peak_power_kw || 0) - newRow.peak_power_kw).toFixed(2)} kW - likely incomplete data)`);
          console.log(`         Generation: ${existing.total_generation_kwh} → ${newRow.total_generation_kwh} kWh`);
          console.log(`         Peak Power: ${existing.peak_power_kw || 0} kW (existing) vs ${newRow.peak_power_kw} kW (calculated)`);
          actions.push({ inverter: newRow.inverter_sn, action: 'blocked_suspicious_drop' });
        } else {
          console.log(`      🔄 ${newRow.inverter_sn}: UPDATE NEEDED`);
          console.log(`         Generation: ${existing.total_generation_kwh} → ${newRow.total_generation_kwh} kWh (Δ ${(newRow.total_generation_kwh - existing.total_generation_kwh).toFixed(2)})`);
          console.log(`         Peak Power: ${existing.peak_power_kw || 0} → ${newRow.peak_power_kw} kW (Δ ${(newRow.peak_power_kw - (existing.peak_power_kw || 0)).toFixed(2)})`);
          actions.push({ inverter: newRow.inverter_sn, action: 'update', data: newRow, oldData: existing });
        }
      } else {
        console.log(`      ✓ ${newRow.inverter_sn}: UNCHANGED (gen=${newRow.total_generation_kwh} kWh, peak=${newRow.peak_power_kw} kW)`);
        actions.push({ inverter: newRow.inverter_sn, action: 'unchanged' });
      }
    }
  }

  // Perform upserts for inserts/updates
  const toUpsert = actions.filter(a => a.action === 'insert' || a.action === 'update').map(a => a.data);
  if (toUpsert.length > 0) {
    console.log(`   💾 Upserting ${toUpsert.length} record(s) to database...`);
    const { error: upsertErr } = await supabase
      .from('inverter_data_daily_summary')
      .upsert(toUpsert, { onConflict: 'inverter_sn,summary_date' });

    if (upsertErr) throw new Error(`Upsert failed for ${summaryDate}: ${upsertErr.message}`);
    console.log(`   ✅ Upsert successful`);
  } else {
    console.log(`   ℹ️  No database changes needed`);
  }

  return { summaryDate, actions };
}

// =============================================================
// MAIN
// =============================================================
async function main() {
  const execStart = Date.now();
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' DAILY INVERTER SUMMARY GENERATOR - START');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🕐 UTC Time:', new Date().toISOString());

  try {
    const todayParts = getColomboDateParts();
    const todayDate = formatDateYYYYMMDD(todayParts);
    const currentHour = getColomboTime();

    console.log(`📅 Today (Sri Lanka local): ${todayDate}`);
    console.log(`🕐 Current Sri Lanka Time: ${currentHour}:xx`);
    console.log(`🔄 Backfilling last ${BACKFILL_DAYS} days...\n`);

    const results = [];
    let totalInserts = 0;
    let totalUpdates = 0;
    let totalUnchanged = 0;
    let totalSkipped = 0;

    for (let daysAgo = BACKFILL_DAYS - 1; daysAgo >= 0; daysAgo--) {
      const dateParts = getDateDaysAgo(daysAgo);
      const dateStr = formatDateYYYYMMDD(dateParts);
      const isToday = dateStr === todayDate;

      // Skip today if current time is before MIN_HOUR_FOR_TODAY_UPDATE
      if (isToday && currentHour < MIN_HOUR_FOR_TODAY_UPDATE) {
        console.log(`⏭️  ${dateStr} (today) - SKIPPED (current time ${currentHour}:xx < ${MIN_HOUR_FOR_TODAY_UPDATE}:00)`);
        totalSkipped++;
        results.push({ date: dateStr, status: 'skipped', reason: 'too_early' });
        continue;
      }

      console.log(`\n📆 Processing ${dateStr}${isToday ? ' (today)' : ''}...`);
      console.log(`${'─'.repeat(60)}`);
      const result = await processSingleDay(dateParts);

      if (result.action === 'skipped') {
        totalSkipped++;
        results.push({ date: dateStr, status: 'skipped', reason: result.reason });
        console.log(`${'─'.repeat(60)}`);
        continue;
      }

      const inserts = result.actions.filter(a => a.action === 'insert').length;
      const updates = result.actions.filter(a => a.action === 'update').length;
      const unchanged = result.actions.filter(a => a.action === 'unchanged').length;
      const blocked = result.actions.filter(a => a.action === 'blocked_suspicious_drop' || a.action === 'skipped_insufficient_data').length;

      totalInserts += inserts;
      totalUpdates += updates;
      totalUnchanged += unchanged;

      console.log(`   📊 Result: ${inserts} inserted, ${updates} updated, ${unchanged} unchanged${blocked > 0 ? `, ${blocked} blocked/skipped` : ''}`);
      console.log(`${'─'.repeat(60)}`);

      results.push({ date: dateStr, status: 'processed', inserts, updates, unchanged, blocked });
    }

    // Optional: Prune very old live data (> 14 days) to keep table lean
    const pruneThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    console.log(`\n🧹 Pruning live data older than ${pruneThreshold.toISOString()} ...`);
    const { error: pruneErr } = await supabase
      .from('inverter_data_live')
      .delete()
      .lt('data_timestamp', pruneThreshold.toISOString());
    if (pruneErr) {
      console.log(`⚠️ Prune warning: ${pruneErr.message}`);
    } else {
      console.log('✅ Prune completed (older than 14 days removed)');
    }

    await logInfo('generate_daily_summary_success', `Processed ${BACKFILL_DAYS} days: ${totalInserts} inserts, ${totalUpdates} updates, ${totalUnchanged} unchanged, ${totalSkipped} skipped`);

    const duration = ((Date.now() - execStart) / 1000).toFixed(2);
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' DAILY SUMMARY GENERATOR - SUCCESS');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   • Total Days Checked: ${BACKFILL_DAYS}`);
    console.log(`   • New Records Inserted: ${totalInserts}`);
    console.log(`   • Records Updated: ${totalUpdates}`);
    console.log(`   • Records Unchanged: ${totalUnchanged}`);
    console.log(`   • Days Skipped: ${totalSkipped}`);
    console.log(`   ⏱ Duration: ${duration}s`);
    console.log('══════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌ DAILY SUMMARY GENERATOR FAILED');
    console.error('   Error:', err.message);
    console.error(err);
    await logError('generate_daily_summary_failed', err.message);
    process.exit(1);
  }
}

// =============================================================
// LOGGING HELPERS
// =============================================================
async function logError(endpoint, message) {
  try {
    await supabase.from('api_logs').insert({ endpoint, success: false, message, created_at: new Date().toISOString() });
  } catch (e) {
    console.error('⚠️ Failed to log error:', e.message);
  }
}

async function logInfo(endpoint, message) {
  try {
    await supabase.from('api_logs').insert({ endpoint, success: true, message, created_at: new Date().toISOString() });
  } catch (e) {
    console.error('⚠️ Failed to log info:', e.message);
  }
}

// =============================================================
// EXECUTION ENTRYPOINT
// =============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
