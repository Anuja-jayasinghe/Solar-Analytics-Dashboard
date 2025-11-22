// Live Inverter Data Fetcher
// Fetches live data from SolisCloud API and stores in inverter_data_live table
// Runs every 5 minutes via GitHub Actions

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../src/lib/solisAuth.js';
import 'dotenv/config';

// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ [CRITICAL] Missing required environment variables:');
  console.error('   - SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.error('   - SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓ Set' : '✗ Missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// MAIN HANDLER
// ============================================
async function main() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     LIVE INVERTER DATA FETCHER - EXECUTION STARTED             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`🕐 Timestamp: ${timestamp}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log('');

  try {
    // Step 1: Fetch inverter list
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Fetching Inverter List from SolisCloud API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const inverters = await getInverterList();
    
    if (inverters.length === 0) {
      console.log('⚠️  [WARNING] No inverters found in SolisCloud account');
      console.log('✅ Job completed (no data to process)');
      return;
    }

    // Step 2: Store live data
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Storing Live Data to Supabase');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await storeLiveData(inverters);

    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ JOB COMPLETED SUCCESSFULLY                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Total execution time: ${duration}s`);
    console.log(`📊 Inverters processed: ${inverters.length}`);
    console.log(`🕐 Completed at: ${new Date().toISOString()}`);
    console.log('');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║                  ❌ JOB FAILED                                  ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error(`💥 Error: ${error.message}`);
    console.error(`⏱️  Failed after: ${duration}s`);
    console.error('');
    console.error('📋 Error Details:');
    console.error(error);
    console.error('');
    
    // Log error to api_logs table
    await logError('fetch_live_data_fatal', error.message);
    
    process.exit(1);
  }
}

// ============================================
// STEP 1: GET INVERTER LIST
// ============================================
async function getInverterList() {
  console.log('📡 Calling SolisCloud API: /v1/api/inverterList');
  console.log('   Request: { pageNo: 1, pageSize: 50 }');
  
  const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });

  // Validate response structure
  if (!response?.success || response?.code !== '0') {
    throw new Error(`SolisCloud API returned error: ${response?.msg || 'Unknown error'}`);
  }

  if (!response?.data?.page?.records) {
    throw new Error('Invalid API response structure: missing data.page.records');
  }

  const inverters = response.data.page.records;
  console.log(`✅ API Response Success`);
  console.log(`   Found ${inverters.length} inverter(s)`);
  
  // Log each inverter
  inverters.forEach((inv, index) => {
    console.log(`   ${index + 1}. SN: ${inv.sn} | Power: ${inv.pac} kW | Generation Today: ${inv.etoday} kWh | Status: ${inv.state}`);
  });

  return inverters;
}

// ============================================
// STEP 2: STORE LIVE DATA TO SUPABASE
// ============================================
async function storeLiveData(inverters) {
  console.log(`🔄 Preparing ${inverters.length} record(s) for database insertion`);
  
  // Map inverter data to table schema
  const liveDataRows = inverters.map((inv) => {
    const record = {
      inverter_sn: inv.sn,
      data_timestamp: new Date(Number(inv.dataTimestamp)),
      power_ac: inv.pac,
      generation_today: inv.etoday,
      inverter_temp: inv.inverterTemperature,
      status: inv.state,
      raw_data: inv, // Store full JSON for debugging
    };
    
    console.log(`   📝 Record prepared: ${inv.sn} @ ${record.data_timestamp.toISOString()}`);
    return record;
  });

  console.log('');
  console.log('💾 Inserting into Supabase table: inverter_data_live');
  console.log('   Conflict resolution: ON CONFLICT (inverter_sn, data_timestamp) DO UPDATE');
  
  const { data, error } = await supabase
    .from('inverter_data_live')
    .upsert(liveDataRows, { onConflict: 'inverter_sn,data_timestamp' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`✅ Successfully upserted ${liveDataRows.length} record(s) to database`);
  console.log('   Table: public.inverter_data_live');
  console.log('   Operation: UPSERT (insert or update on conflict)');
}

// ============================================
// ERROR LOGGING
// ============================================
async function logError(endpoint, message) {
  try {
    console.log('📝 Logging error to api_logs table...');
    await supabase.from('api_logs').insert({ 
      endpoint, 
      success: false, 
      message,
      created_at: new Date().toISOString()
    });
    console.log('✅ Error logged successfully');
  } catch (logErr) {
    console.error('⚠️  Failed to log error to database:', logErr.message);
  }
}

// ============================================
// EXECUTION
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
