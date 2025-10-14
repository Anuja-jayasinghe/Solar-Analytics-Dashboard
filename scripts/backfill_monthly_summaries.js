// scripts/backfill_monthly_summaries.js
//
// ✅ One-time script to backfill monthly summary data
// Run with: node scripts/backfill_monthly_summaries.js
// Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in .env

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function backfillMonthlySummaries() {
  console.log('🚀 Starting one-time monthly summary backfill...\n');

  try {
    // 1️⃣ Get distinct inverter SNs
    const { data: inverters, error: invErr } = await supabase
      .from('inverter_data_daily_summary')
      .select('inverter_sn')
      .order('inverter_sn', { ascending: true })
      .not('inverter_sn', 'is', null)
      .neq('inverter_sn', '');

    if (invErr) throw invErr;
    if (!inverters || inverters.length === 0) {
      console.warn('⚠️ No inverter records found in daily summary table.');
      return;
    }

    console.log(`📡 Found ${inverters.length} inverter(s) to backfill.\n`);

    let totalInserted = 0;

    for (const { inverter_sn } of inverters) {
      console.log(`📊 Processing inverter ${inverter_sn}...`);

      // 2️⃣ Fetch all daily records for this inverter
      const { data: dailyData, error: dailyErr } = await supabase
        .from('inverter_data_daily_summary')
        .select('summary_date, total_generation_kwh, peak_power_kw')
        .eq('inverter_sn', inverter_sn)
        .order('summary_date', { ascending: true });

      if (dailyErr) {
        console.error(`❌ Failed to fetch daily data for ${inverter_sn}: ${dailyErr.message}`);
        continue;
      }

      // 3️⃣ Aggregate by month
      const monthlyTotals = {};
      for (const row of dailyData) {
        const month = row.summary_date.slice(0, 7); // "YYYY-MM"
        if (!monthlyTotals[month]) {
          monthlyTotals[month] = {
            inverter_sn,
            summary_month: month,
            total_generation_kwh: 0,
            peak_power_kw: 0,
            created_at: new Date().toISOString(),
          };
        }

        monthlyTotals[month].total_generation_kwh += Number(row.total_generation_kwh || 0);
        monthlyTotals[month].peak_power_kw = Math.max(
          monthlyTotals[month].peak_power_kw,
          Number(row.peak_power_kw || 0)
        );
      }

      const monthlyRows = Object.values(monthlyTotals);
      if (monthlyRows.length === 0) {
        console.log(`🟡 No daily data found for inverter ${inverter_sn}. Skipping.`);
        continue;
      }

      // 4️⃣ Upsert into monthly summary table
      const { error: upsertErr } = await supabase
        .from('inverter_data_monthly_summary')
        .upsert(monthlyRows, { onConflict: 'inverter_sn,summary_month' });

      if (upsertErr) {
        console.error(`💥 Upsert failed for ${inverter_sn}: ${upsertErr.message}`);
      } else {
        console.log(`✅ Stored ${monthlyRows.length} monthly records for ${inverter_sn}.\n`);
        totalInserted += monthlyRows.length;
      }
    }

    console.log(`\n🟢 Monthly summary backfill complete!`);
    console.log(`📈 Total monthly records inserted/updated: ${totalInserted}`);
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
  }
}

backfillMonthlySummaries();
