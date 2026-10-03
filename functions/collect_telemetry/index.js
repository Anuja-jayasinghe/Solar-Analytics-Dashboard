// functions/collect_telemetry/index.js
//
// CLI for the telemetry collector (issue #156). Real SolisCloud + Supabase adapters around the
// tested core in run.js.
//
//   node functions/collect_telemetry/index.js                       dry run, last 7 completed days
//   node functions/collect_telemetry/index.js --write               nightly: write last 7 days
//   node functions/collect_telemetry/index.js --from 2024-08-02 --to 2026-10-02 --write
//   node functions/collect_telemetry/index.js --fill-peaks --write  also set NULL summary peaks
//   node functions/collect_telemetry/index.js --from 2024-08-02 --concurrency 4   long ranges: several days in flight
//
// SAFE BY DEFAULT: without --write nothing is written anywhere. Today is never processed
// (the day is incomplete) unless --include-today is given. Exit code is non-zero unless the run
// fully succeeded — a run that processed nothing has not succeeded.
//
// Needs SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role), SOLIS_API_URL/ID/SECRET.

import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { solisFetch } from '../../api/_lib/solisAuth.js';
import { addDays, eachDateKey, isDateKey, localDateKey } from '../../shared/domain/time.js';
import { runCollector } from './run.js';

const MAX_DAYS = 900;
const SOLIS_GAP_MS = 700; // documented limit is 2 calls/second; stay well under it

function parseArgs(argv) {
  const a = { write: false, fillPeaks: false, includeToday: false, days: 7, concurrency: 1, from: null, to: null, job: 'collect_telemetry' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--write') a.write = true;
    else if (k === '--fill-peaks') a.fillPeaks = true;
    else if (k === '--include-today') a.includeToday = true;
    else if (k === '--from') a.from = argv[++i];
    else if (k === '--to') a.to = argv[++i];
    else if (k === '--days') a.days = Number(argv[++i]);
    else if (k === '--concurrency') a.concurrency = Number(argv[++i]);
    else if (k === '--job') a.job = argv[++i];
    else throw new Error(`unknown argument: ${k}`);
  }
  return a;
}

export function resolveDates({ from, to, days, includeToday }, nowMs = Date.now()) {
  const today = localDateKey(nowMs);
  const last = includeToday ? today : addDays(today, -1);
  const end = to ? to : last;
  if (!isDateKey(end)) throw new Error(`--to must be YYYY-MM-DD, got ${end}`);
  const clampedEnd = end > last ? last : end;
  let start = from;
  if (!start) {
    if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer');
    start = addDays(clampedEnd, -(days - 1));
  }
  if (!isDateKey(start)) throw new Error(`--from must be YYYY-MM-DD, got ${start}`);
  if (start > clampedEnd) throw new Error(`nothing to do: from ${start} is after ${clampedEnd}`);
  const dates = eachDateKey(start, clampedEnd);
  if (dates.length > MAX_DAYS) throw new Error(`range of ${dates.length} days exceeds ${MAX_DAYS}`);
  return dates;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeSolis() {
  // Each call reserves the next free start slot synchronously, so concurrent callers are spaced
  // SOLIS_GAP_MS apart however many are in flight (the API limit is on request STARTS per second).
  let nextSlot = 0;
  async function call(path, body) {
    const startAt = Math.max(Date.now(), nextSlot);
    nextSlot = startAt + SOLIS_GAP_MS;
    const wait = startAt - Date.now();
    if (wait > 0) await sleep(wait);
    const res = await solisFetch(path, body);
    if (String(res?.code) !== '0') throw new Error(`${path}: ${res?.msg ?? 'unknown error'} (code ${res?.code})`);
    return res.data;
  }
  return {
    async listInverters() {
      const data = await call('/v1/api/inverterList', { pageNo: 1, pageSize: 100 });
      const rec = (data?.page?.records ?? data?.records ?? [])[0];
      if (!rec) return null;
      return { sn: rec.sn, collectorSn: rec.collectorSn ?? null, stationId: rec.stationId ?? null };
    },
    // timeZone is ignored by the API (docs/SOLIS_API_FIELD_CATALOG.md F5) but the schema requires it.
    inverterDay: (sn, time) => call('/v1/api/inverterDay', { sn, money: 'LKR', time, timeZone: 8 }),
    collectorDay: (sn, time) => call('/v1/api/collector/day', { sn, time, timeZone: 8 }),
    async alarms(sn, stationId, from, to) {
      const all = [];
      for (let pageNo = 1; pageNo <= 200; pageNo++) {
        const data = await call('/v1/api/alarmList', {
          pageNo, pageSize: 100, stationId, alarmDeviceSn: sn, alarmBeginTime: from, alarmEndTime: to
        });
        const records = data?.records ?? data?.page?.records ?? [];
        all.push(...records);
        const pages = Number(data?.pages ?? data?.page?.pages ?? 1);
        if (!records.length || pageNo >= pages) break;
      }
      return all;
    }
  };
}

function makeDb(supabase, sn) {
  const must = async (q) => {
    const { error, data } = await q;
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    async startRun(info) {
      const data = await must(supabase.from('collector_runs').insert(info).select('id').single());
      return data.id;
    },
    async finishRun(id, patch) {
      await must(supabase.from('collector_runs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', id));
    },
    async upsert(table, rows, onConflict) {
      if (rows.length) await must(supabase.from(table).upsert(rows, { onConflict }));
    },
    async replaceSegments(inverterSn, day, rows) {
      await must(supabase.from('inverter_status_segments').delete().eq('inverter_sn', inverterSn).eq('day', day));
      if (rows.length) await must(supabase.from('inverter_status_segments').insert(rows));
    },
    async getSummary(from, to) {
      return must(
        supabase.from('inverter_data_daily_summary').select('summary_date,total_generation_kwh,peak_power_kw')
          .eq('inverter_sn', sn).gte('summary_date', from).lte('summary_date', to)
      );
    },
    async setPeakIfNull(day, peakKw) {
      const data = await must(
        supabase.from('inverter_data_daily_summary').update({ peak_power_kw: peakKw })
          .eq('inverter_sn', sn).eq('summary_date', day).is('peak_power_kw', null).select('id')
      );
      return data.length > 0;
    }
  };
}

function summaryMarkdown(r) {
  const rows = r.days.map((d) => `| ${d.dateKey} | ${d.status} | ${d.points} | ${d.uptimePct === null ? '—' : d.uptimePct.toFixed(1) + '%'} | ${d.trips} | ${d.gaps} | ${d.error ?? ''} |`);
  return [
    `## Telemetry collector (${r.write ? 'WRITE' : 'DRY RUN'}): ${r.status.toUpperCase()}`,
    '', `Days: ${r.dates} · points written: ${r.pointsWritten} · alarms: ${r.alarmsFetched ?? 'fetch failed'} (written ${r.alarmsWritten})`,
    `Failed days: ${r.failedDays} · collector failures: ${r.collectorFailures} · peaks filled: ${r.peaksFilled} (would fill ${r.peaksWouldFill})`,
    r.error ? `\n**Error:** ${r.error}` : '',
    r.reconcile.length ? `\n**Daily summary disagrees with the inverter on ${r.reconcile.length} day(s):** ${r.reconcile.slice(0, 20).map((x) => `${x.dateKey} (${x.summaryKwh} vs ${x.solisKwh})`).join(', ')}` : '',
    r.missingSummary.length ? `\n**Days with telemetry but no daily summary row:** ${r.missingSummary.map((x) => x.dateKey).join(', ')}` : '',
    '', '| Day | Status | Points | Uptime | Trips | Gaps | Error |', '|---|---|---|---|---|---|---|', ...rows.slice(0, 120),
    r.days.length > 120 ? `\n_…${r.days.length - 120} more days omitted_` : ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dates = resolveDates(args);
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 6) throw new Error('--concurrency must be an integer from 1 to 6');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (service_role) are required');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const solis = makeSolis();
  const inv = await solis.listInverters();
  if (!inv) throw new Error('SolisCloud returned no inverter');
  const db = makeDb(supabase, inv.sn);

  console.log(`mode=${args.write ? 'WRITE' : 'DRY RUN'} job=${args.job} days=${dates.length} (${dates[0]} → ${dates[dates.length - 1]}) fillPeaks=${args.fillPeaks} concurrency=${args.concurrency}`);
  const report = await runCollector({
    solis, db, dates, write: args.write, fillPeaks: args.fillPeaks, concurrency: args.concurrency, job: args.job,
    log: (m) => console.log(m)
  });

  for (const d of report.days) {
    console.log(`${d.dateKey}  ${String(d.status).padEnd(8)} points=${String(d.points).padStart(4)} uptime=${d.uptimePct === null ? '—' : d.uptimePct.toFixed(1) + '%'} trips=${d.trips} gaps=${d.gaps}${d.error ? '  ERROR ' + d.error : ''}`);
  }
  console.log(`\nstatus=${report.status} pointsWritten=${report.pointsWritten} alarms=${report.alarmsFetched}/${report.alarmsWritten} failedDays=${report.failedDays} peaksFilled=${report.peaksFilled} wouldFill=${report.peaksWouldFill}`);
  if (report.reconcile.length) console.log(`reconcile: ${report.reconcile.length} day(s) differ from daily summary`);
  if (report.error) console.log(`error: ${report.error}`);

  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report) + '\n');
  if (report.status !== 'ok') process.exitCode = 1;
}

// Run only when executed directly, so resolveDates can be imported by tests.
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('collect_telemetry/index.js')) {
  main().catch((e) => {
    console.error(`FATAL: ${e.message}`);
    process.exit(1);
  });
}
