// ./functions/update_total_generation/index.js
import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js'; // fixed path
import 'dotenv/config';

// --- Supabase Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Solis Credentials Check ---
const { SOLIS_API_ID, SOLIS_API_SECRET } = process.env;
if (!SOLIS_API_ID || !SOLIS_API_SECRET) {
  console.error('❌ Missing Solis API credentials.');
  process.exit(1);
}

// --- Main Handler ---
async function handler() {
  console.log(`🚀 ETotal Update Job started at ${new Date().toISOString()}`);

  try {
    const total = await fetchEtTotal();

    if (total === null) {
      throw new Error('No etotal value returned from API');
    }

    await updateDatabase(total);
    console.log(`✅ Successfully updated total_generation = ${total} kWh`);
  } catch (err) {
    console.error('💥 Fatal error in update_etotal:', err.message);
    await logError('update_etotal', err.message);
  }
}

// --- Fetch latest etotal from SolisCloud ---
async function fetchEtTotal() {
  console.log('➡️ Fetching etotal data from SolisCloud...');

  const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });

  if (!response?.success || response?.code !== '0' || !response?.data?.page?.records?.length) {
    throw new Error(`Failed to fetch inverter list: ${response?.msg || 'Invalid response'}`);
  }

  // Take the latest etotal from first inverter (or adjust if multiple inverters exist)
  const inverter = response.data.page.records[0];
  const total = Number(inverter.etotal || 0);

  console.log(`📊 Latest etotal from SolisCloud: ${total} kWh`);
  return total;
}

// --- Update Supabase system_metrics table ---
async function updateDatabase(total) {
  console.log('🗃️ Updating system_metrics table...');

  const { error } = await supabase.from('system_metrics').upsert(
    {
      metric_name: 'total_generation',
      metric_value: total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'metric_name' }
  );

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  console.log('✅ Supabase system_metrics updated successfully.');
}

// --- Error Logging ---
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
