// scripts/backfill-daily-summaries.js

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../src/lib/solisAuth.js'; // Adjust path if needed
import 'dotenv/config'; // For running locally

// --- Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Optional safety cap
const MAX_MONTHS = 36; // Backfill up to the last 3 years
const RATE_LIMIT_DELAY_MS = 1000; // 1 second between Solis requests

// --- Supabase Client Initialization ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables. Create a .env file for local execution.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Utility: delay to respect API limits
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main backfill handler
 */
async function backfill() {
  console.log('🚀 Starting one-time historical data backfill...\n');

  let totalInserted = 0;

  try {
    // 1. Get the list of inverters
    const listRes = await solisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
    if (!listRes?.success || listRes?.code !== '0') {
      throw new Error(`Failed to fetch inverter list: ${listRes?.msg}`);
    }
    const inverters = listRes.data.page.records;
    console.log(`📡 Found ${inverters.length} inverter(s) to process.\n`);

    for (const inverter of inverters) {
      const { sn, fisGenerateTime } = inverter;
      if (!fisGenerateTime) {
        console.warn(`⚠️ Skipping inverter ${sn} — no 'First Generation Time' detected.`);
        continue;
      }

      const startDate = new Date(fisGenerateTime);
      const endDate = new Date();
      console.log(`\n--- ⚙️ Processing inverter ${sn} from ${startDate.toDateString()} to today ---`);

      let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      let monthCount = 0;
      let insertedCount = 0;

      while (currentDate <= endDate && monthCount < MAX_MONTHS) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const monthString = `${year}-${month}`;

        console.log(`➡️ Fetching data for ${monthString}...`);

        // --- Skip month if already exists in DB ---
        const { data: existing, error: existingErr } = await supabase
          .from('inverter_data_daily_summary')
          .select('summary_date')
          .eq('inverter_sn', sn)
          .gte('summary_date', `${year}-${month}-01`)
          .lt('summary_date', `${year}-${month}-31`)
          .limit(1);

        if (existingErr) {
          console.warn(`⚠️ Could not check existing data for ${monthString}: ${existingErr.message}`);
        } else if (existing && existing.length > 0) {
          console.log(`🟡 Skipping ${monthString} — data already exists.`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          continue;
        }

        // --- Fetch month data from SolisCloud ---
        const monthRes = await solisFetch('/v1/api/inverterMonth', {
          sn: sn,
          month: monthString,
          money: 'USD',
        });

        if (!monthRes?.success || monthRes?.code !== '0' || !Array.isArray(monthRes.data)) {
          console.error(`❌ Failed to get data for ${monthString}: ${monthRes?.msg || 'Invalid response'}`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        const dailyRecords = monthRes.data;
        if (dailyRecords.length === 0) {
          console.log(`📭 No records found for ${monthString}.`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        // --- Format data for summary table ---
        const summaryRows = dailyRecords.map((record) => ({
          inverter_sn: sn,
          summary_date: record.dateStr,
          total_generation_kwh: record.energy,
          peak_power_kw: 0,
          avg_temperature: 0,
          uptime_minutes: 0,
        }));

        // --- Insert or update into Supabase ---
        const { error: upsertError } = await supabase
          .from('inverter_data_daily_summary')
          .upsert(summaryRows, { onConflict: 'inverter_sn,summary_date' });

        if (upsertError) {
          console.error(`💥 Supabase upsert failed for ${monthString}: ${upsertError.message}`);
        } else {
          console.log(`✅ Stored ${summaryRows.length} records for ${monthString}.`);
          insertedCount += summaryRows.length;
          totalInserted += summaryRows.length;
        }

        // --- Move to next month ---
        currentDate.setMonth(currentDate.getMonth() + 1);
        monthCount++;
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      console.log(`📊 Completed inverter ${sn}: ${insertedCount} records added.\n`);
    }

    console.log('🟢 Historical backfill completed successfully!');
    console.log(`📈 Total daily records added: ${totalInserted}`);

  } catch (err) {
    console.error('💥 A fatal error occurred during the backfill process:', err.message);
  }
}

// Run the backfill function
backfill();
