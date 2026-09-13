// scripts/backfill_daily_summaries.js
//
// ✅ One-time script to backfill inverter daily summaries into Supabase
// Run locally: node scripts/backfill_daily_summaries.js
//
// Features:
//  - Rate-limited SolisCloud API calls (1/sec)
//  - Skips already existing months in DB
//  - Retries failed API calls up to 2 times
//  - Safe to re-run (uses upsert)
//  - Logs progress and totals clearly

import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../api/_lib/solisAuth.js';
import 'dotenv/config';

// --- Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MAX_MONTHS = 36; // Limit to 3 years
const RATE_LIMIT_DELAY_MS = 1000; // 1 second delay
const RETRY_LIMIT = 2; // Retry API fetch twice before skipping

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Utility: Sleep ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Utility: Safe Solis Fetch with retry ---
async function safeSolisFetch(path, body, retries = 0) {
  try {
    return await solisFetch(path, body);
  } catch (err) {
    if (retries < RETRY_LIMIT) {
      const delay = (retries + 1) * 1500;
      console.warn(`⚠️ SolisFetch failed (${err.message}). Retrying in ${delay}ms...`);
      await sleep(delay);
      return safeSolisFetch(path, body, retries + 1);
    }
    throw new Error(`❌ SolisFetch failed after ${RETRY_LIMIT + 1} attempts: ${err.message}`);
  }
}

// --- Main Function ---
async function backfill() {
  console.log('🚀 Starting one-time daily summary backfill...\n');

  let totalInserted = 0;

  try {
    // 1️⃣ Get list of inverters
    const listRes = await safeSolisFetch('/v1/api/inverterList', { pageNo: 1, pageSize: 50 });
    if (!listRes?.success || listRes?.code !== '0') throw new Error(listRes?.msg || 'Failed to fetch inverter list.');

    const inverters = listRes.data.page.records;
    console.log(`📡 Found ${inverters.length} inverter(s) to process.\n`);

    for (const inverter of inverters) {
      const { sn, fisGenerateTime } = inverter;
      if (!fisGenerateTime) {
        console.warn(`⚠️ Skipping inverter ${sn} (no first generation time).`);
        continue;
      }

      const startDate = new Date(Number(fisGenerateTime));
      const endDate = new Date();
      let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      let insertedCount = 0;
      let monthCount = 0;

      console.log(`\n--- ⚙️ Processing inverter ${sn} from ${startDate.toDateString()} ---`);

      // 2️⃣ Month loop
      while (currentDate <= endDate && monthCount < MAX_MONTHS) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`;

        // Skip if month already in DB
        const { data: existing, error: existErr } = await supabase
          .from('inverter_data_daily_summary')
          .select('summary_date', { count: 'exact', head: true })
          .eq('inverter_sn', sn)
          .gte('summary_date', `${year}-${month}-01`)
          .lt('summary_date', `${year}-${month}-31`);

        if (existErr) {
          console.warn(`⚠️ Could not check existing records for ${monthStr}: ${existErr.message}`);
        } else if (existing && existing.length > 0) {
          console.log(`🟡 Skipping ${monthStr} — already in DB.`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          continue;
        }

        console.log(`➡️ Fetching Solis data for ${monthStr}...`);

        // 3️⃣ Fetch from Solis API
        const monthRes = await safeSolisFetch('/v1/api/inverterMonth', {
          sn,
          month: monthStr,
          money: 'USD',
        });

        if (!monthRes?.success || monthRes?.code !== '0' || !Array.isArray(monthRes.data)) {
          console.error(`❌ Skipping ${monthStr}: ${monthRes?.msg || 'Invalid response.'}`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        const records = monthRes.data;
        if (records.length === 0) {
          console.log(`🟡 No data for ${monthStr}.`);
          currentDate.setMonth(currentDate.getMonth() + 1);
          monthCount++;
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        // 4️⃣ Format records for Supabase
        const summaryRows = records.map((r) => ({
          inverter_sn: sn,
          summary_date: r.dateStr, // format: YYYY-MM-DD
          total_generation_kwh: r.energy || 0,
          peak_power_kw: r.maxPower || 0,
          created_at: new Date().toISOString(),
        }));

        // 5️⃣ Upsert to Supabase
        const { error } = await supabase
          .from('inverter_data_daily_summary')
          .upsert(summaryRows, { onConflict: 'inverter_sn,summary_date' });

        if (error) {
          console.error(`💥 Supabase upsert failed for ${monthStr}: ${error.message}`);
        } else {
          console.log(`✅ ${summaryRows.length} records added for ${monthStr}.`);
          insertedCount += summaryRows.length;
          totalInserted += summaryRows.length;
        }

        currentDate.setMonth(currentDate.getMonth() + 1);
        monthCount++;
        await sleep(RATE_LIMIT_DELAY_MS);
      }

      console.log(`📊 Finished inverter ${sn}: ${insertedCount} records inserted.`);
    }

    console.log('\n🟢 Backfill completed successfully!');
    console.log(`📈 Total daily records inserted: ${totalInserted}\n`);
  } catch (err) {
    console.error('💥 Fatal error during backfill:', err.message);
  }
}

// --- Run ---
backfill();
