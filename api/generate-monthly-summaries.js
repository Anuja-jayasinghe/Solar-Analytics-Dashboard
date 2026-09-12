// SECURITY: this endpoint previously had no authentication and no method check. It runs with
// the Supabase service-role key and calls the SolisCloud API, so anyone on the internet could
// invoke it repeatedly to burn our Solis quota and Vercel execution time. It has no callers
// anywhere in the repo — it is operator-triggered only — so it is now admin-gated.
// Vercel Serverless Function: Aggregate daily summaries into monthly summaries
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from './middleware/verifyAdminToken.js';
import { handlePreflightAndMethod } from './_lib/httpSecurity.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return; // verifyAdminToken has already sent 401/403

  try {
    const { data: inverters, error: invErr } = await supabase
      .from('inverter_data_daily_summary')
      .select('inverter_sn')
      .order('inverter_sn', { ascending: true })
      .not('inverter_sn', 'is', null)
      .neq('inverter_sn', '');
    if (invErr) throw invErr;

    let totalInserted = 0;
    for (const { inverter_sn } of inverters || []) {
      const { data: dailyData, error: dailyErr } = await supabase
        .from('inverter_data_daily_summary')
        .select('summary_date, total_generation_kwh, peak_power_kw')
        .eq('inverter_sn', inverter_sn)
        .order('summary_date', { ascending: true });
      if (dailyErr) continue;

      const monthlyMap = {};
      for (const row of dailyData) {
        const month = row.summary_date.slice(0, 7);
        if (!monthlyMap[month]) {
          monthlyMap[month] = { inverter_sn, summary_month: month, total_generation_kwh: 0, peak_power_kw: 0 };
        }
        monthlyMap[month].total_generation_kwh += Number(row.total_generation_kwh || 0);
        monthlyMap[month].peak_power_kw = Math.max(monthlyMap[month].peak_power_kw, Number(row.peak_power_kw || 0));
      }

      const monthlyRows = Object.values(monthlyMap);
      if (monthlyRows.length > 0) {
        await supabase
          .from('inverter_data_monthly_summary')
          .upsert(monthlyRows, { onConflict: 'inverter_sn,summary_month' });
        totalInserted += monthlyRows.length;
      }
    }

    res.status(200).json({ ok: true, totalInserted });
  } catch (err) {
    console.error('generate-monthly-summaries error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
