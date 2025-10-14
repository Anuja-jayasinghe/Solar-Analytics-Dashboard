// scripts/backfill-daily-summaries.js

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js';
import 'dotenv/config';

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MAX_MONTHS = 36; // Limit to last 3 years
const RATE_LIMIT_DELAY_MS = 1000; // 1 second delay between API calls

// --- Supabase Client Initialization ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Helper: Delay ---
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main Function ---
async function backfill() {
  console.log('🚀 Starting daily summary backfill...\n');
  let totalInserted = 0;

  try {
    const listRes = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
    if (!listRes?.success || listRes?.code !== '0') throw new Error(listRes?.msg || 'Failed to fetch inverter list.');

    const inverters = listRes.data.page.records;
    console.log(`📡 Found ${inverters.length} inverter(s).\n`);

    for (const inverter of inverters) {
      const { sn, fisGenerateTime } = inverter;
      if (!fisGenerateTime) {
        console.warn(`⚠️ Skipping inverter ${sn} (no first generation time).`);
        continue;
      }

      const startDate = new Date(fisGenerateTime);
      const endDate = new Date();
      let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      let insertedCount = 0;
      let monthCount = 0;

      console.log(`\n--- ⚙️ Processing inverter ${sn} from ${startDate.toDateString()} ---`);

      while (currentDate <= endDate && monthCount < MAX_MONTHS) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const monthString = `${year}-${month}`;

        // Skip if already exists
        const { data: existing } = await supabase
          .from('inverter_data_daily_summary')
          .select('summary_date')
          .eq('inverter_sn', sn)
          .gte('summary_date', `${year}-${month}-01`)
          .lt('summary_date', `${year}-${month}-31`)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`🟡 Skipping ${monthString} (already exists).`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          continue;
        }

        console.log(`➡️ Fetching data for ${monthString}...`);
        const monthRes = await solisFetch('/v1/api/inverterMonth', {
          sn,
          month: monthString,
          money: 'USD',
        });

        if (!monthRes?.success || monthRes?.code !== '0' || !Array.isArray(monthRes.data)) {
          console.error(`❌ Failed for ${monthString}: ${monthRes?.msg || 'Invalid response'}`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        const summaryRows = monthRes.data.map((r) => ({
          inverter_sn: sn,
          summary_date: r.dateStr,
          total_generation_kwh: r.energy,
          peak_power_kw: 0, // Solis doesn’t return this; can add later
        }));

        const { error } = await supabase
          .from('inverter_data_daily_summary')
          .upsert(summaryRows, { onConflict: 'inverter_sn,summary_date' });

        if (error) {
          console.error(`💥 Upsert failed for ${monthString}: ${error.message}`);
        } else {
          console.log(`✅ Stored ${summaryRows.length} records for ${monthString}.`);
          insertedCount += summaryRows.length;
          totalInserted += summaryRows.length;
        }

        currentDate.setMonth(currentDate.getMonth() + 1);
        monthCount++;
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      console.log(`📊 Done inverter ${sn}: ${insertedCount} daily records added.`);
    }

    console.log('\n🟢 Backfill completed successfully!');
    console.log(`📈 Total daily records inserted: ${totalInserted}\n`);
  } catch (err) {
    console.error('💥 Fatal backfill error:', err.message);
  }
}

backfill();
