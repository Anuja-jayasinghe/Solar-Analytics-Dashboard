// scripts/rederive_uptime.mjs
//
// Re-derive inverter_day_uptime and inverter_status_segments from the FACTS already stored
// (inverter_telemetry, collector_heartbeats, inverter_alarms) using the current LR-002 logic.
// No SolisCloud calls. Use it after the derivation rules change (the 2026-10-03 correction of
// comms alarms is why it exists) or if a derived row is ever damaged: the derived tables are
// regenerable by design (docs/adr/001).
//
//   node scripts/rederive_uptime.mjs            DRY RUN: shows what would change, writes nothing
//   node scripts/rederive_uptime.mjs --write    applies it
//
// Safe: reads three fact tables, writes only the two derived tables, changes only days whose
// result differs, and is idempotent.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { exitOnServiceKeyProblem } from '../api/_lib/serviceKeyGuard.js';
import { deriveDayUptime } from '../shared/domain/uptime.js';
import { toSegmentRows, toUptimeRow } from '../shared/domain/telemetryPipeline.js';
import { localDateKey } from '../shared/domain/time.js';

const WRITE = process.argv.includes('--write');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
exitOnServiceKeyProblem(url, key);
const sb = createClient(url, key, { auth: { persistSession: false } });

async function pagedAll(build) {
  const out = [];
  for (let page = 0; page < 400; page++) {
    const { data, error } = await build().range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
  throw new Error('paging safety limit reached');
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log(`mode=${WRITE ? 'WRITE' : 'DRY RUN'}  loading stored facts…`);
const [uptime, telemetry, beats, alarmRows] = await Promise.all([
  pagedAll(() => sb.from('inverter_day_uptime').select('*').order('day')),
  pagedAll(() => sb.from('inverter_telemetry').select('inverter_sn,ts').order('ts')),
  pagedAll(() => sb.from('collector_heartbeats').select('ts').order('ts')),
  pagedAll(() => sb.from('inverter_alarms').select('*').order('begin_ts'))
]);
console.log(`  derived days ${uptime.length} · telemetry ${telemetry.length} · heartbeats ${beats.length} · alarms ${alarmRows.length}`);

const sn = uptime[0]?.inverter_sn;
const byDay = (rows, f) => {
  const m = new Map();
  for (const r of rows) {
    const d = localDateKey(Date.parse(r.ts));
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(f(r));
  }
  return m;
};
const pointsByDay = byDay(telemetry, (r) => ({ ts: Date.parse(r.ts) }));
const beatsByDay = byDay(beats, (r) => ({ ts: Date.parse(r.ts) }));
const alarms = alarmRows.map((a) => ({
  code: a.alarm_code, beginMs: Date.parse(a.begin_ts), endMs: a.end_ts ? Date.parse(a.end_ts) : null,
  open: a.state === 0, level: a.level, state: a.state
}));

const changed = [];
const newUptime = [];
const newSegments = new Map();
for (const old of uptime) {
  const day = String(old.day).slice(0, 10);
  // Preserve what was known at collection time: a day whose logger fetch had failed stays "unknown".
  const collector = old.logger_known ? (beatsByDay.get(day) ?? []) : null;
  const derived = deriveDayUptime({
    dateKey: day, points: pointsByDay.get(day) ?? [], alarms: old.alarms_known ? alarms : null, collector
  });
  const row = toUptimeRow(sn, derived);
  const prev = { pct: old.uptime_pct === null ? null : Number(old.uptime_pct), trip: Number(old.trip_min), comms: Number(old.comms_lost_min), gap: Number(old.gap_min) };
  const next = { pct: row.uptime_pct, trip: row.trip_min, comms: row.comms_lost_min, gap: row.gap_min };
  newUptime.push(row);
  newSegments.set(day, toSegmentRows(sn, derived));
  if (!same(prev, next) || old.status !== row.status) changed.push({ day, status: [old.status, row.status], prev, next });
}

const fmt = (v) => (v === null ? '—' : v.toFixed(1));
console.log(`\n${changed.length} of ${uptime.length} days change.`);
for (const c of changed.slice(0, 60)) {
  console.log(`  ${c.day}  uptime ${fmt(c.prev.pct)} → ${fmt(c.next.pct)}   trip ${c.prev.trip} → ${c.next.trip} min   comms ${c.prev.comms} → ${c.next.comms} min   gap ${c.prev.gap} → ${c.next.gap} min`);
}
if (changed.length > 60) console.log(`  …and ${changed.length - 60} more`);
const mean = (rows) => { const v = rows.filter((r) => r.uptime_pct !== null); return v.reduce((s, r) => s + r.uptime_pct, 0) / v.length; };
console.log(`\nmean uptime across days: before ${mean(uptime.map((u) => ({ uptime_pct: u.uptime_pct === null ? null : Number(u.uptime_pct) }))).toFixed(2)}%  after ${mean(newUptime).toFixed(2)}%`);

if (!WRITE) {
  console.log('\nDry run: nothing was written. Re-run with --write to apply.');
  process.exit(0);
}

const changedDays = new Set(changed.map((c) => c.day));
const rowsToWrite = newUptime.filter((r) => changedDays.has(r.day));
for (let i = 0; i < rowsToWrite.length; i += 200) {
  const { error } = await sb.from('inverter_day_uptime').upsert(rowsToWrite.slice(i, i + 200), { onConflict: 'inverter_sn,day' });
  if (error) throw new Error(`uptime upsert failed: ${error.message}`);
}
const days = [...changedDays];
for (let i = 0; i < days.length; i += 50) {
  const chunk = days.slice(i, i + 50);
  const del = await sb.from('inverter_status_segments').delete().eq('inverter_sn', sn).in('day', chunk);
  if (del.error) throw new Error(`segment delete failed: ${del.error.message}`);
  const ins = chunk.flatMap((d) => newSegments.get(d));
  for (let j = 0; j < ins.length; j += 500) {
    const r = await sb.from('inverter_status_segments').insert(ins.slice(j, j + 500));
    if (r.error) throw new Error(`segment insert failed: ${r.error.message}`);
  }
}
console.log(`\nWrote ${rowsToWrite.length} day rows and re-built their segments.`);
