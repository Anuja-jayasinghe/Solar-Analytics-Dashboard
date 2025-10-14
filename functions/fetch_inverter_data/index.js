// ./functions/fetch-inverter-data/index.js

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../src/lib/solisAuth.js';
import 'dotenv/config';

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RETENTION_DAYS = 30; // Clean up after 30 days

// --- Supabase Client ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Main Job Handler ---
async function handler() {
  console.log(`🚀 SolisCloud Sync Job started at ${new Date().toISOString()}`);
  const currentUTCHour = new Date().getUTCHours();
  const isNightlyRun = currentUTCHour === 18; // 18:00 UTC = 11:30 PM LK

  try {
    const inverters = await getInverterList();
    if (inverters.length === 0) return;

    await fetchAndStoreLiveData(inverters);

    if (isNightlyRun) {
      console.log('🌙 Running nightly summary + cleanup...');
      await summarizeDailyData(inverters);
      await pruneOldLiveData();
    }

    console.log('✅ Sync completed successfully.');
  } catch (err) {
    console.error('💥 Fatal error in handler:', err.message);
    await logError('handler_fatal_error', err.message);
  }
}

// --- Fetch inverter list from SolisCloud ---
async function getInverterList() {
  console.log('➡️ Fetching inverter list...');
  const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });

  if (!response?.success || response?.code !== '0' || !response?.data?.page?.records) {
    throw new Error(`Failed to fetch inverter list: ${response?.msg || 'Invalid response'}`);
  }

  const inverters = response.data.page.records;
  console.log(`📡 Found ${inverters.length} inverter(s).`);
  return inverters;
}

// --- Store live data into Supabase ---
async function fetchAndStoreLiveData(inverters) {
  console.log('🔄 Fetching live inverter data...');
  const liveDataRows = inverters.map((inv) => ({
    inverter_sn: inv.sn,
    data_timestamp: new Date(Number(inv.dataTimestamp)),
    power_ac: inv.pac,
    generation_today: inv.etoday,
    inverter_temp: inv.inverterTemperature,
    status: inv.state,
    raw_data: inv,
  }));

  const { error } = await supabase
    .from('inverter_data_live')
    .upsert(liveDataRows, { onConflict: 'inverter_sn,data_timestamp' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  console.log(`✅ Upserted ${liveDataRows.length} live records.`);
}

// --- Create daily summary for each inverter ---
async function summarizeDailyData(inverters) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const inverter of inverters) {
    const { data: records, error } = await supabase
      .from('inverter_data_live')
      .select('power_ac, generation_today')
      .eq('inverter_sn', inverter.sn)
      .gte('data_timestamp', today.toISOString());

    if (error) {
      console.error(`⚠️ Could not fetch records for ${inverter.sn}: ${error.message}`);
      continue;
    }

    if (!records.length) {
      console.warn(`⚠️ No records found for inverter ${inverter.sn}.`);
      continue;
    }

    const totalGeneration = Math.max(...records.map((r) => r.generation_today));
    const peakPower = Math.max(...records.map((r) => r.power_ac));

    const summaryRow = {
      inverter_sn: inverter.sn,
      summary_date: today.toISOString().split('T')[0],
      total_generation_kwh: totalGeneration,
      peak_power_kw: peakPower,
    };

    const { error: upsertError } = await supabase
      .from('inverter_data_daily_summary')
      .upsert(summaryRow, { onConflict: 'inverter_sn,summary_date' });

    if (upsertError) {
      console.error(`💥 Summary upsert failed for ${inverter.sn}: ${upsertError.message}`);
    } else {
      console.log(`✅ Summary stored for inverter ${inverter.sn}.`);
    }
  }
}

// --- Prune old live data ---
async function pruneOldLiveData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  console.log(`🗑️ Cleaning records older than ${cutoff.toISOString()}...`);

  const { error } = await supabase
    .from('inverter_data_live')
    .delete()
    .lt('data_timestamp', cutoff.toISOString());

  if (error) throw new Error(`Failed to prune data: ${error.message}`);
  console.log('✅ Old data pruned.');
}

// --- Error logging helper ---
async function logError(endpoint, message) {
  try {
    await supabase.from('api_logs').insert({ endpoint, success: false, message });
  } catch (logErr) {
    console.error('⚠️ Failed to log error to Supabase:', logErr.message);
  }
}

// --- Local Execution ---
if (import.meta.url === `file://${process.argv[1]}`) {
  handler();
}
