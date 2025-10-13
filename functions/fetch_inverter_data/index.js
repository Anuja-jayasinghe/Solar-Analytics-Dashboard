// ./functions/fetch-inverter-data/index.js

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../src/lib/solisAuth.js'; // Adjust path if needed
import 'dotenv/config'; // Used for local testing

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RETENTION_DAYS = 30; // Data older than this will be pruned from the live table

// --- Supabase Client Initialization ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables. Ensure they are set in GitHub Secrets.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Main Handler ---
async function handler() {
  console.log(`🚀 Starting SolisCloud sync job at ${new Date().toISOString()}`);

  // Determine if this is a nightly summary run based on UTC time
  const currentUTCHour = new Date().getUTCHours();
  const isNightlyRun = currentUTCHour === 18; // 18:00 UTC is 11:30 PM in Sri Lanka

  try {
    const inverters = await getInverterList();
    if (inverters.length === 0) return;

    await fetchAndStoreLiveData(inverters);

    if (isNightlyRun) {
      console.log('🌙 Running nightly summary and prune tasks...');
      await summarizeDailyData(inverters);
      await pruneOldLiveData();
    }

    console.log('✅ Job finished successfully.');
  } catch (err) {
    console.error('💥 A fatal error occurred:', err.message);
    await logError('handler_fatal_error', err.message);
  }
}

// --- Core Logic Functions ---

async function getInverterList() {
  console.log('➡️ Fetching inverter list...');
  const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });

  if (!response?.success || response?.code !== '0' || !response?.data?.page?.records) {
    throw new Error(`Failed to fetch inverter list: ${response?.msg || 'Invalid response structure'}`);
  }
  
  const inverters = response.data.page.records;
  console.log(`Found ${inverters.length} inverter(s).`);
  return inverters;
}

async function fetchAndStoreLiveData(inverters) {
  console.log('🔄 Fetching and storing live data...');
  const liveDataRows = [];

  for (const inverter of inverters) {
    // We get all necessary data from the inverterList endpoint, no need for a second call.
    liveDataRows.push({
      inverter_sn: inverter.sn,
      data_timestamp: new Date(Number(inverter.dataTimestamp)),
      power_ac: inverter.pac,
      generation_today: inverter.etoday,
      inverter_temp: inverter.inverterTemperature,
      status: inverter.state,
      raw_data: inverter, // Storing the full payload as requested
    });
  }

  if (liveDataRows.length > 0) {
    const { error } = await supabase.from('inverter_data_live').upsert(liveDataRows, {
      onConflict: 'inverter_sn,data_timestamp',
    });
    if (error) throw new Error(`Supabase live data upsert failed: ${error.message}`);
    console.log(`Upserted ${liveDataRows.length} live data records.`);
  }
}

async function summarizeDailyData(inverters) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Start of today in UTC

  for (const inverter of inverters) {
    const { data: dailyRecords, error } = await supabase
      .from('inverter_data_live')
      .select('power_ac, generation_today, inverter_temp, status')
      .eq('inverter_sn', inverter.sn)
      .gte('data_timestamp', today.toISOString());

    if (error) {
      console.error(`Could not fetch records for daily summary of ${inverter.sn}: ${error.message}`);
      continue;
    }

    if (dailyRecords.length === 0) {
      console.warn(`No records found for today to summarize for inverter ${inverter.sn}.`);
      continue;
    }

    // Calculate summaries
    const totalGeneration = Math.max(...dailyRecords.map(r => r.generation_today));
    const peakPower = Math.max(...dailyRecords.map(r => r.power_ac));
    const avgTemp = dailyRecords.reduce((sum, r) => sum + r.inverter_temp, 0) / dailyRecords.length;
    const uptimeMinutes = dailyRecords.filter(r => r.status === 1).length * 5; // Assuming 5-min intervals

    const summaryRow = {
      inverter_sn: inverter.sn,
      summary_date: today.toISOString().split('T')[0],
      total_generation_kwh: totalGeneration,
      peak_power_kw: peakPower,
      avg_temperature: parseFloat(avgTemp.toFixed(2)),
      uptime_minutes: uptimeMinutes,
    };

    const { error: summaryError } = await supabase.from('inverter_data_daily_summary').upsert(summaryRow, {
        onConflict: 'inverter_sn,summary_date',
    });
    if (summaryError) throw new Error(`Supabase summary upsert failed for ${inverter.sn}: ${summaryError.message}`);
    console.log(`✅ Daily summary created for inverter ${inverter.sn}.`);
  }
}

async function pruneOldLiveData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - RETENTION_DAYS);

  console.log(`🗑️ Pruning live data older than ${thirtyDaysAgo.toISOString()}...`);

  const { error } = await supabase
    .from('inverter_data_live')
    .delete()
    .lt('data_timestamp', thirtyDaysAgo.toISOString());

  if (error) throw new Error(`Failed to prune old live data: ${error.message}`);
  console.log('✅ Pruning complete.');
}

// --- Helper for Logging ---
async function logError(endpoint, message) {
  try {
    await supabase.from('api_logs').insert({ endpoint, success: false, message });
  } catch (logErr) {
    console.error('⚠️ Failed to log error to Supabase:', logErr.message);
  }
}

// --- Entry Point for Direct Execution ---
// This allows running the script locally with `node index.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  handler();
}