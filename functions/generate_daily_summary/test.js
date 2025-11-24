// Test script for daily summary backfill logic
// Run with: node functions/generate_daily_summary/test.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testChecks() {
  console.log('\n🧪 Testing Daily Summary Backfill Logic\n');

  // Test 1: Check current Sri Lanka time
  console.log('Test 1: Current Sri Lanka Time');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit'
  });
  const colomboTime = formatter.format(new Date());
  console.log(`   ✅ Current time in Sri Lanka: ${colomboTime}`);

  // Test 2: Check last 5 days of data
  console.log('\nTest 2: Last 5 Days Summary Records');
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: summaries, error: summaryErr } = await supabase
    .from('inverter_data_daily_summary')
    .select('summary_date, inverter_sn, total_generation_kwh, peak_power_kw')
    .gte('summary_date', fiveDaysAgo)
    .order('summary_date', { ascending: false });

  if (summaryErr) {
    console.error('   ❌ Error:', summaryErr.message);
  } else {
    console.log(`   ✅ Found ${summaries.length} summary records`);
    summaries.forEach(s => {
      console.log(`      ${s.summary_date} | ${s.inverter_sn} | ${s.total_generation_kwh} kWh | ${s.peak_power_kw} kW`);
    });
  }

  // Test 3: Check for gaps in last 30 days
  console.log('\nTest 3: Check for Missing Days (Last 30 Days)');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: allSummaries, error: allErr } = await supabase
    .from('inverter_data_daily_summary')
    .select('summary_date, inverter_sn')
    .gte('summary_date', thirtyDaysAgo)
    .order('summary_date', { ascending: true });

  if (allErr) {
    console.error('   ❌ Error:', allErr.message);
  } else {
    const dateSet = new Set(allSummaries.map(s => s.summary_date));
    const missingDates = [];
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      if (!dateSet.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }

    if (missingDates.length === 0) {
      console.log('   ✅ No gaps found - all 30 days have records');
    } else {
      console.log(`   ⚠️  Found ${missingDates.length} missing dates:`);
      missingDates.forEach(d => console.log(`      - ${d}`));
    }
  }

  // Test 4: Check live data availability
  console.log('\nTest 4: Live Data Availability (Last 3 Days)');
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: liveData, error: liveErr } = await supabase
    .from('inverter_data_live')
    .select('data_timestamp, inverter_sn, generation_today, power_ac')
    .gte('data_timestamp', threeDaysAgo)
    .order('data_timestamp', { ascending: false })
    .limit(10);

  if (liveErr) {
    console.error('   ❌ Error:', liveErr.message);
  } else {
    console.log(`   ✅ Found ${liveData.length} recent live data records (showing 10)`);
    liveData.slice(0, 5).forEach(d => {
      console.log(`      ${d.data_timestamp} | ${d.inverter_sn} | ${d.generation_today} kWh | ${d.power_ac} kW`);
    });
  }

  // Test 5: Validate timezone handling
  console.log('\nTest 5: Timezone Handling');
  const now = new Date();
  const utcDate = now.toISOString().split('T')[0];
  
  const colomboFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = colomboFormatter.formatToParts(now).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const colomboDate = `${parts.year}-${parts.month}-${parts.day}`;

  console.log(`   ✅ UTC Date: ${utcDate}`);
  console.log(`   ✅ Colombo Date: ${colomboDate}`);
  if (utcDate !== colomboDate) {
    console.log(`   ℹ️  Dates differ (timezone boundary)`);
  }

  console.log('\n✅ All tests complete!\n');
}

testChecks().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  console.error(err);
  process.exit(1);
});
