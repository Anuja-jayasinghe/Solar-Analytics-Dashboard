// scripts/check_data_freshness.js
// Fails loudly when inverter data collection has silently stopped.
//
// Background: between 2026-01-20 and 2026-04-18 this repo had no commits. GitHub disabled
// both scheduled workflows for inactivity, collection stopped on 2026-04-15, and nobody
// noticed for five months. This check exists so the next stoppage is caught in days.
//
// It is deliberately source-agnostic: it asserts on the DATA, not on the workflow. A disabled
// workflow, rotated Solis credentials, a paused Supabase project and an upstream API change
// all produce the same symptom — stale rows — and all trip this check.
//
// Usage:
//   node scripts/check_data_freshness.js
//   node scripts/check_data_freshness.js --json   (machine-readable output)
//
// Exit codes:
//   0  all monitored tables are fresh
//   1  at least one table is stale  (or the check could not run)

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// -------------------------------------------------------------
// Thresholds
// -------------------------------------------------------------
// Daily summaries: the generator skips today's row before 23:00 Sri Lanka time, so
// "yesterday" is the freshest row we can ever expect. 2 days allows for one missed run.
const MAX_SUMMARY_AGE_DAYS = Number(process.env.MAX_SUMMARY_AGE_DAYS || 2);

// Live data: the 5-minute fetcher has a quiet window of 20:00-04:59 Sri Lanka time, so a
// gap of up to ~9h is normal overnight. 12h means it genuinely stopped.
const MAX_LIVE_AGE_HOURS = Number(process.env.MAX_LIVE_AGE_HOURS || 12);

const jsonOutput = process.argv.slice(2).includes('--json');

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function daysBetween(later, earlier) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

function describeAge(days) {
  if (days < 1) return 'less than a day';
  if (days < 60) return `${Math.floor(days)} days`;
  return `${Math.floor(days)} days (~${Math.round(days / 30)} months)`;
}

// -------------------------------------------------------------
// Checks
// -------------------------------------------------------------
async function checkDailySummary() {
  const { data, error } = await supabase
    .from('inverter_data_daily_summary')
    .select('summary_date')
    .order('summary_date', { ascending: false })
    .limit(1);

  if (error) {
    return { name: 'inverter_data_daily_summary', ok: false, reason: `query failed: ${error.message}` };
  }

  const latest = data?.[0]?.summary_date;
  if (!latest) {
    return { name: 'inverter_data_daily_summary', ok: false, reason: 'table is empty' };
  }

  // summary_date is a DATE column; compare at UTC midnight to avoid a timezone off-by-one.
  const ageDays = daysBetween(new Date(), new Date(`${latest}T00:00:00Z`));

  return {
    name: 'inverter_data_daily_summary',
    ok: ageDays <= MAX_SUMMARY_AGE_DAYS,
    latest,
    ageDays: Number(ageDays.toFixed(2)),
    threshold: `${MAX_SUMMARY_AGE_DAYS} days`,
    reason: ageDays <= MAX_SUMMARY_AGE_DAYS
      ? null
      : `newest row is ${describeAge(ageDays)} old (limit ${MAX_SUMMARY_AGE_DAYS} days)`
  };
}

async function checkLiveData() {
  const { data, error } = await supabase
    .from('inverter_data_live')
    .select('data_timestamp')
    .order('data_timestamp', { ascending: false })
    .limit(1);

  if (error) {
    return { name: 'inverter_data_live', ok: false, reason: `query failed: ${error.message}` };
  }

  const latest = data?.[0]?.data_timestamp;
  if (!latest) {
    return { name: 'inverter_data_live', ok: false, reason: 'table is empty' };
  }

  const ageHours = (Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60);

  return {
    name: 'inverter_data_live',
    ok: ageHours <= MAX_LIVE_AGE_HOURS,
    latest,
    ageHours: Number(ageHours.toFixed(1)),
    threshold: `${MAX_LIVE_AGE_HOURS} hours`,
    reason: ageHours <= MAX_LIVE_AGE_HOURS
      ? null
      : `newest row is ${ageHours.toFixed(1)} hours old (limit ${MAX_LIVE_AGE_HOURS} hours)`
  };
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
async function main() {
  const results = [await checkDailySummary(), await checkLiveData()];
  const stale = results.filter(r => !r.ok);

  if (jsonOutput) {
    console.log(JSON.stringify({ healthy: stale.length === 0, results }, null, 2));
    process.exit(stale.length === 0 ? 0 : 1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   INVERTER DATA FRESHNESS CHECK                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (r.latest) console.log(`   Newest row : ${r.latest}`);
    if (r.ageDays !== undefined) console.log(`   Age        : ${describeAge(r.ageDays)}`);
    if (r.ageHours !== undefined) console.log(`   Age        : ${r.ageHours} hours`);
    if (r.threshold) console.log(`   Threshold  : ${r.threshold}`);
    if (r.reason) console.log(`   Problem    : ${r.reason}`);
    console.log('');
  }

  if (stale.length === 0) {
    console.log('✅ All monitored tables are fresh.');
    process.exit(0);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`❌ ${stale.length} table(s) stale — data collection has stopped.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Check, in this order:');
  console.log('  1. Are the scheduled workflows still enabled?');
  console.log('     gh workflow list --all');
  console.log('     (state `disabled_inactivity` means GitHub switched them off)');
  console.log('  2. Did the last runs fail?');
  console.log('     gh run list --workflow=fetch-live-inverter-data.yml --limit 5');
  console.log('  3. Are the SOLIS_* / SUPABASE_* repo secrets still valid?');
  console.log('  4. Is the Supabase project active (free tier pauses when idle)?');
  console.log('');
  console.log('Once collection is restored, refill the gap:');
  console.log('  node scripts/backfill_all_missing_daily.js --dry');
  console.log('  node scripts/backfill_all_missing_daily.js');
  process.exit(1);
}

main().catch((err) => {
  console.error('💥 Freshness check crashed:', err?.message || err);
  process.exit(1);
});
