// Vercel Serverless Function: Fetch inverter data and store in Supabase
import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RETENTION_DAYS = 30;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getInverterList() {
  const response = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
  if (!response?.success || response?.code !== '0' || !response?.data?.page?.records) {
    throw new Error(`Failed to fetch inverter list: ${response?.msg || 'Invalid response'}`);
  }
  return response.data.page.records;
}

async function fetchAndStoreLiveData(inverters) {
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
}

async function summarizeDailyData(inverters) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const inverter of inverters) {
    const { data: records, error } = await supabase
      .from('inverter_data_live')
      .select('power_ac, generation_today')
      .eq('inverter_sn', inverter.sn)
      .gte('data_timestamp', today.toISOString());
    if (error) continue;
    if (!records.length) continue;
    const totalGeneration = Math.max(...records.map((r) => r.generation_today));
    const peakPower = Math.max(...records.map((r) => r.power_ac));
    const summaryRow = {
      inverter_sn: inverter.sn,
      summary_date: today.toISOString().split('T')[0],
      total_generation_kwh: totalGeneration,
      peak_power_kw: peakPower,
    };
    await supabase
      .from('inverter_data_daily_summary')
      .upsert(summaryRow, { onConflict: 'inverter_sn,summary_date' });
  }
}

async function pruneOldLiveData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  await supabase
    .from('inverter_data_live')
    .delete()
    .lt('data_timestamp', cutoff.toISOString());
}

export default async function handler(req, res) {
  try {
    const inverters = await getInverterList();
    if (inverters.length === 0) return res.status(200).json({ ok: true, message: 'No inverters found' });

    await fetchAndStoreLiveData(inverters);

    const currentUTCHour = new Date().getUTCHours();
    const isNightlyRun = currentUTCHour === 18; // 18:00 UTC = 11:30 PM LK
    if (isNightlyRun) {
      await summarizeDailyData(inverters);
      await pruneOldLiveData();
    }

    res.status(200).json({ ok: true, message: 'Sync completed' });
  } catch (err) {
    console.error('fetch-inverter-data error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
