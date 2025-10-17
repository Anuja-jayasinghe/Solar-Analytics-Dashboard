// ./functions/generate_monthly_summaries/index.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateMonthlySummaries() {
  console.log(`🚀 Starting monthly summary generation at ${new Date().toISOString()}`);

  try {
    // 1️⃣ Fetch distinct inverter serials
    const { data: inverters, error: invErr } = await supabase
      .from('inverter_data_daily_summary')
      .select('inverter_sn')
      .order('inverter_sn', { ascending: true })
      .not('inverter_sn', 'is', null)
      .neq('inverter_sn', '');

    if (invErr) throw invErr;
    if (!inverters || inverters.length === 0) {
      console.warn('⚠️ No inverters found in daily summary table.');
      return;
    }

    console.log(`📡 Found ${inverters.length} inverter(s) to aggregate.\n`);

    let totalInserted = 0;

    for (const { inverter_sn } of inverters) {
      console.log(`📊 Aggregating monthly data for inverter ${inverter_sn}...`);

      // 2️⃣ Group daily data into monthly totals
      const { data: monthlyData, error: aggErr } = await supabase
        .from('inverter_data_daily_summary')
        .select('summary_date, total_generation_kwh, peak_power_kw')
        .eq('inverter_sn', inverter_sn)
        .order('summary_date', { ascending: true });

      if (aggErr) {
        console.error(`❌ Failed to fetch daily data for ${inverter_sn}: ${aggErr.message}`);
        continue;
      }

      // 3️⃣ Reduce by month
      const monthlyMap = {};
      for (const record of monthlyData) {
        const month = record.summary_date.slice(0, 7); // "YYYY-MM"
        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            inverter_sn,
            summary_month: month,
            total_generation_kwh: 0,
            peak_power_kw: 0,
          };
        }

        monthlyMap[month].total_generation_kwh += Number(record.total_generation_kwh || 0);
        monthlyMap[month].peak_power_kw = Math.max(
          monthlyMap[month].peak_power_kw,
          Number(record.peak_power_kw || 0)
        );
      }

      const monthlyRows = Object.values(monthlyMap);
      if (monthlyRows.length === 0) {
        console.log(`🟡 No daily data found for ${inverter_sn}.`);
        continue;
      }

      // 4️⃣ Upsert monthly summaries
      const { error: upsertErr } = await supabase
        .from('inverter_data_monthly_summary')
        .upsert(monthlyRows, { onConflict: 'inverter_sn,summary_month' });

      if (upsertErr) {
        console.error(`💥 Upsert failed for ${inverter_sn}: ${upsertErr.message}`);
      } else {
        console.log(`✅ Stored ${monthlyRows.length} monthly records for ${inverter_sn}.`);
        totalInserted += monthlyRows.length;
      }
    }

    console.log(`\n🟢 Monthly summary generation complete!`);
    console.log(`📈 Total monthly records inserted or updated: ${totalInserted}`);
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
  }
}

generateMonthlySummaries();
