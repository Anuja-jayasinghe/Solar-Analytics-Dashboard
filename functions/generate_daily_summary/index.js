// Daily Inverter Summary Generator
// Aggregates live inverter data into daily summaries (total generation & peak power)
// Intended schedule: once per day shortly after solar window ends (Sri Lanka time ~20:35 local / 15:05 UTC approx)

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
    // Determine target local date (Asia/Colombo). We summarize "today" local.
    const todayParts = getColomboDateParts();
    const summaryDate = formatDateYYYYMMDD(todayParts); // YYYY-MM-DD (local date)
    const { startUTC, endUTC } = getUTCWindowForLocalDay(todayParts);

    console.log(`📅 Summary Date (Sri Lanka local): ${summaryDate}`);
    console.log(`🔎 UTC Window: ${startUTC.toISOString()} -> ${endUTC.toISOString()}`);

    // Fetch live data rows within the local day window
    console.log('📥 Fetching live inverter data for aggregation...');
    const { data: liveRows, error: liveErr } = await supabase
      .from('inverter_data_live')
      .select('inverter_sn,power_ac,generation_today,data_timestamp')
      .gte('data_timestamp', startUTC.toISOString())
      .lte('data_timestamp', endUTC.toISOString());

    if (liveErr) throw new Error(`Failed to fetch live data: ${liveErr.message}`);
    if (!liveRows || liveRows.length === 0) {
      console.log('⚠️ No live data rows found for target window. Nothing to summarize.');
      await logInfo('generate_daily_summary_no_data', `No rows for ${summaryDate}`);
      return;
    }

    console.log(`✅ Retrieved ${liveRows.length} live data rows`);

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
      // generation_today expected to be cumulative for the day; take max
      if (typeof row.generation_today === 'number' && row.generation_today > agg.maxGenerationToday) {
        agg.maxGenerationToday = row.generation_today;
      }
      // Track peak AC power (kW)
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

    console.log('🧮 Aggregation complete:');
    summaryRows.forEach(r => {
      console.log(`   • ${r.inverter_sn} => total_generation_kwh=${r.total_generation_kwh} | peak_power_kw=${r.peak_power_kw}`);
    });

    // Upsert daily summaries
    console.log('💾 Upserting summary rows into inverter_data_daily_summary ...');
    const { error: upsertErr } = await supabase
      .from('inverter_data_daily_summary')
      .upsert(summaryRows, { onConflict: 'inverter_sn,summary_date' });

    if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);
    console.log(`✅ Upsert successful for ${summaryRows.length} inverter(s)`);

    // Optional: Prune very old live data (> 14 days) to keep table lean
    const pruneThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    console.log(`🧹 Pruning live data older than ${pruneThreshold.toISOString()} ...`);
    const { error: pruneErr } = await supabase
      .from('inverter_data_live')
      .delete()
      .lt('data_timestamp', pruneThreshold.toISOString());
    if (pruneErr) {
      console.log(`⚠️ Prune warning: ${pruneErr.message}`);
    } else {
      console.log('✅ Prune completed (older than 14 days removed)');
    }

    await logInfo('generate_daily_summary_success', `Generated summaries for ${summaryDate}`);

    const duration = ((Date.now() - execStart) / 1000).toFixed(2);
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' DAILY SUMMARY GENERATOR - SUCCESS');
    console.log(` ⏱ Duration: ${duration}s`);
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
