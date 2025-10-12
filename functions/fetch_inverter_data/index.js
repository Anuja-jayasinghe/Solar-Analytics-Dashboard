import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../src/lib/solisAuth.js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function handler() {
  console.log('🛰️ Fetch job started at', new Date().toISOString());

  try {
    // Step 1️⃣: Get inverter list
    console.log('➡️ Fetching inverter list from SolisCloud...');
    const listRes = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });

    if (!listRes?.success || listRes?.code !== '0') {
      console.error('❌ inverterList API failed:', listRes);
      await logError('/v1/api/inverterList', listRes.msg || 'Unknown error');
      return;
    }

    const inverters = listRes?.data?.page?.records || [];
    console.log(`✅ inverterList fetched ${inverters.length} inverter(s).`);

    if (inverters.length === 0) {
      console.warn('⚠️ No inverters returned. Check SolisCloud credentials or account setup.');
      await logError('/v1/api/inverterList', 'No inverters returned');
      return;
    }

    // Step 2️⃣: Fetch details for each inverter
    const rows = [];
    for (const inv of inverters) {
      const { inverterId, inverterSn, stationId, stationName } = inv;

      console.log(`🔄 Fetching details for inverter ${inverterSn}...`);
      const detailRes = await solisFetch('/v1/api/inverterDetailList', {
        inverterSn,
        pageNo: 1,
        pageSize: 1,
      });

      if (detailRes?.success && detailRes?.code === '0') {
        const detail = detailRes?.data?.page?.records?.[0];
        if (!detail) {
          console.warn(`⚠️ No details found for inverter ${inverterSn}`);
          continue;
        }

        rows.push({
          inverter_id: inverterId,
          inverter_sn: inverterSn,
          station_id: stationId,
          station_name: stationName,
          etoday: detail.etoday,
          etotal: detail.etotal,
          pac: detail.pac,
          fac: detail.fac,
          inverter_temp: detail.inverterTemperature,
          state: detail.state,
          last_updated: new Date(),
          raw_data: detail,
        });

        console.log(`✅ Got details for ${inverterSn} (etoday: ${detail.etoday}, pac: ${detail.pac})`);
      } else {
        console.error(`❌ inverterDetailList failed for ${inverterSn}:`, detailRes?.msg || 'No message');
        await logError('/v1/api/inverterDetailList', detailRes?.msg || 'Failed to fetch inverter details');
      }
    }

    if (rows.length === 0) {
      console.warn('⚠️ No valid inverter data collected. Nothing to insert.');
      return;
    }

    // Step 3️⃣: Upsert into Supabase
    console.log(`⬆️ Upserting ${rows.length} inverter record(s) to Supabase...`);
    const { data: result, error } = await supabase
      .from('inverter_data')
      .upsert(rows, { onConflict: 'inverter_sn' })
      .select();

    if (error) {
      console.error('❌ Supabase upsert error:', error.message);
      await logError('supabase_upsert', error.message);
      return;
    }

    console.log(`✅ Successfully upserted ${result?.length || 0} record(s) to inverter_data.`);

    // Step 4️⃣: Log success
    await supabase.from('api_logs').insert({
      endpoint: '/v1/api/inverterDetailList',
      response_code: '200',
      success: true,
      message: `Synced ${rows.length} inverters`,
    });

    console.log('🟢 Job completed successfully.');
  } catch (err) {
    console.error('💥 Unexpected error during fetch:', err.message);
    await logError('fetch_inverter_data', err.message);
  }
}

async function logError(endpoint, message) {
  try {
    await supabase.from('api_logs').insert({
      endpoint,
      success: false,
      message,
    });
  } catch (logErr) {
    console.error('⚠️ Failed to log error:', logErr.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  handler();
}
