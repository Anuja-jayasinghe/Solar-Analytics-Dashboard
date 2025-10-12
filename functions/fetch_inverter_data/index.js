import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../src/lib/solisAuth.js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function handler() {
  try {
    // Step 1: Get inverter list
    const listRes = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
    if (!listRes.success || listRes.code !== '0') throw new Error(listRes.msg);

    const inverters = listRes.data.page.records || [];

    // Step 2: For each inverter, fetch details
    const rows = [];
    for (const inv of inverters) {
      const { inverterId, inverterSn, stationId, stationName } = inv;

      const detailRes = await solisFetch('/v1/api/inverterDetailList', {
        inverterSn,
        pageNo: 1,
        pageSize: 1
      });

      if (detailRes.success && detailRes.code === '0') {
        const detail = detailRes.data.page.records[0];
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
          raw_data: detail
        });
      }
    }

    // Step 3: Upsert into Supabase
    const { error } = await supabase
      .from('inverter_data')
      .upsert(rows, { onConflict: 'inverter_sn' });

    if (error) throw error;

    // Step 4: Log success
    await supabase.from('api_logs').insert({
      endpoint: '/v1/api/inverterDetailList',
      response_code: '200',
      success: true,
      message: `Synced ${rows.length} inverters`
    });

    console.log(`✅ Synced ${rows.length} inverters`);
  } catch (err) {
    console.error('❌ Error syncing inverter data:', err.message);
    await supabase.from('api_logs').insert({
      endpoint: 'fetch_inverter_data',
      success: false,
      message: err.message
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  handler();
}
