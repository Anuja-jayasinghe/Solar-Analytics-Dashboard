// shared/demo/demoData.js
//
// Deterministic DEMO dataset for visitors without real access (decision D-3), and the in-memory
// repository that serves it through the SAME resource functions as the real API
// (shared/data/resources.js). Because the demo runs the real code, it cannot drift from the real
// response shapes, and the real uptime/alignment logic generates the demo's uptime rows.
//
// DECISION D-8: every demo date is in 2035 or later, so no screen can be mistaken for real data.
// Identifiers are fake ('DEMO-…'), the tariff and plant size are deliberately not the real ones,
// and the generator is seeded (same output every time, safe for tests and screenshots).
//
// The dataset deliberately contains every state the UI must render honestly:
//   * a normal run of days with grid under-voltage trips
//   * a 3-day outage that is a measured zero (inverter down, logger alive)
//   * a 5-day collection gap: NO daily rows and NO uptime rows (unknown, not zero)
//   * a day with a silent logger mid-day (comms_lost, excluded from uptime)
//   * a late start (edge_gap)
//   * a tariff change (40 → 44 LKR/kWh) to show per-bill effective rates
//   * a still-open bill period (CEB side null)

import { addDays, eachDateKey, operatingWindow, startOfLocalDayMs } from '../domain/time.js';
import { deriveDayUptime } from '../domain/uptime.js';
import { toSegmentRows, toUptimeRow } from '../domain/telemetryPipeline.js';

export const DEMO = Object.freeze({
  start: '2035-01-01',
  today: '2036-09-15', // "now" for the demo
  inverterSn: 'DEMO-INV-0000',
  collectorSn: 'DEMO-LOG-0000',
  capacityKwp: 50,
  acRatedKw: 45,
  dailyTargetKwh: 150,
  rateBefore: 40,
  rateAfter: 44,
  rateChangeDate: '2036-03-04' // first bill dated on/after this uses rateAfter
});

const OUTAGE_DAYS = new Set(['2035-11-10', '2035-11-11', '2035-11-12']); // measured zero, inverter down
const COLLECTION_GAP = new Set(['2036-03-02', '2036-03-03', '2036-03-04', '2036-03-05', '2036-03-06']); // nothing recorded
const COMMS_LOST_DAY = '2036-05-20';
const LATE_START_DAY = '2036-07-08';

const MIN = 60_000;

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seedStr) {
  let a = hashSeed(seedStr);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (n, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

function dailyEnergy(dateKey) {
  const r = rng(`kwh|${dateKey}`);
  const month = Number(dateKey.slice(5, 7));
  const seasonal = 135 + 28 * Math.sin(((month - 3) / 12) * 2 * Math.PI); // peaks ~ Mar-Apr, dips mid-year
  const weather = r() < 0.12 ? 0.35 + r() * 0.3 : 0.8 + r() * 0.35; // some overcast days
  return Math.max(8, round(seasonal * weather, 1));
}

function tripsForDay(dateKey) {
  const r = rng(`trips|${dateKey}`);
  const win = operatingWindow(dateKey);
  const n = r() < 0.4 ? 0 : 1 + Math.floor(r() * 3);
  return Array.from({ length: n }, () => {
    const startMs = win.startMs + Math.floor(r() * (win.minutes - 15)) * MIN;
    const durMin = r() < 0.7 ? 5 : 10;
    return { code: '1011', beginMs: startMs, endMs: startMs + durMin * MIN, open: false, level: 1, state: 2, durationMs: durMin * MIN };
  });
}

function pointTimestamps(dateKey) {
  const win = operatingWindow(dateKey);
  const first = win.startMs - 20 * MIN;
  const out = [];
  for (let t = first; t <= win.endMs + 20 * MIN; t += 5 * MIN) out.push(t);
  return out;
}

function heartbeats(dateKey) {
  const dayStart = startOfLocalDayMs(dateKey);
  return Array.from({ length: 288 }, (_, i) => ({ ts: dayStart + i * 5 * MIN }));
}

/** Build the whole dataset once. Pure and deterministic. */
export function createDemoDataset() {
  const dates = eachDateKey(DEMO.start, addDays(DEMO.today, -1));

  const dailyRows = [];
  for (const date of dates) {
    if (COLLECTION_GAP.has(date)) continue; // unknown, not zero
    if (OUTAGE_DAYS.has(date)) {
      dailyRows.push({ date, kwh: 0, peakKw: 0 }); // a MEASURED zero
      continue;
    }
    const kwh = dailyEnergy(date);
    dailyRows.push({ date, kwh, peakKw: round(Math.min(DEMO.acRatedKw, kwh / 4.6 + (hashSeed(date) % 30) / 10), 1) });
  }

  // Bills: one a month, dated the 3rd-5th, covering [previous bill + 1, bill date] (LR-001).
  const kwhByDate = new Map(dailyRows.map((r) => [r.date, r.kwh]));
  const bills = [];
  let prev = null;
  for (let y = 2035, m = 2; ; m++) {
    if (m > 12) { m = 1; y++; }
    const billDate = `${y}-${String(m).padStart(2, '0')}-0${3 + (m % 3)}`;
    if (billDate >= DEMO.today) break;
    const start = prev ? addDays(prev, 1) : addDays(billDate, -30);
    let sum = 0;
    for (const d of eachDateKey(start, billDate)) sum += kwhByDate.get(d) ?? 0;
    const units = Math.round(sum * 0.97);
    const rate = billDate >= DEMO.rateChangeDate ? DEMO.rateAfter : DEMO.rateBefore;
    bills.push({ bill_date: billDate, units_exported: units, earnings: units * rate });
    prev = billDate;
  }

  // Uptime: run the REAL derivation over synthetic points/alarms/heartbeats.
  const uptimeRows = [];
  const segments = [];
  const alarmRows = [];
  for (const date of dates) {
    if (COLLECTION_GAP.has(date)) continue; // collector recorded nothing, so no row at all
    const trips = tripsForDay(date);
    const alarms = trips.map((t) => ({ ...t }));
    let points = pointTimestamps(date).map((ts) => ({ ts }));
    let collector = heartbeats(date);

    if (OUTAGE_DAYS.has(date)) points = []; // inverter silent, logger alive → measured outage
    if (date === COMMS_LOST_DAY) {
      const w = operatingWindow(date);
      const a = w.startMs + 200 * MIN;
      const b = a + 90 * MIN;
      points = points.filter((p) => p.ts < a || p.ts > b);
      collector = collector.filter((h) => h.ts < a || h.ts > b);
    }
    if (date === LATE_START_DAY) {
      const w = operatingWindow(date);
      points = points.filter((p) => p.ts > w.startMs + 110 * MIN);
    }

    const derived = deriveDayUptime({ dateKey: date, points, alarms: OUTAGE_DAYS.has(date) ? [] : alarms, collector });
    uptimeRows.push(toUptimeRow(DEMO.inverterSn, derived));
    segments.push(...toSegmentRows(DEMO.inverterSn, derived));
    if (!OUTAGE_DAYS.has(date)) {
      for (const a of alarms) {
        alarmRows.push({
          inverter_sn: DEMO.inverterSn, alarm_code: a.code, begin_ts: new Date(a.beginMs).toISOString(),
          end_ts: new Date(a.endMs).toISOString(), duration_ms: a.durationMs, level: 1, state: 2,
          message: 'DEMO grid under-voltage', advice: 'Demo data: no action required'
        });
      }
    }
  }

  return {
    dates, dailyRows, bills, uptimeRows, segments,
    alarmRows: alarmRows.sort((a, b) => (a.begin_ts < b.begin_ts ? 1 : -1)),
    settings: { ratePerKwh: DEMO.rateBefore, capacityKwp: DEMO.capacityKwp, acRatedKw: DEMO.acRatedKw, dailyTargetKwh: DEMO.dailyTargetKwh }
  };
}

function demoTelemetryDay(date) {
  const win = operatingWindow(date);
  if (!win) return [];
  const r = rng(`tele|${date}`);
  const peak = Math.min(DEMO.acRatedKw, dailyEnergy(date) / 4.4);
  const out = [];
  for (let t = win.startMs - 20 * MIN; t <= win.endMs + 20 * MIN; t += 5 * MIN) {
    const x = (t - win.startMs) / (win.endMs - win.startMs); // 0..1 across the window
    const bell = x <= 0 || x >= 1 ? 0.02 : Math.sin(Math.PI * x) ** 1.6;
    const pac = round(Math.max(0, peak * bell * (0.92 + r() * 0.16)), 3);
    const volts = round(226 + (r() - 0.5) * 18, 1);
    out.push({
      ts: new Date(t).toISOString(), state: 1, pac_kw: pac,
      pv_v: Array.from({ length: 8 }, () => round(560 + (r() - 0.5) * 40, 1)),
      pv_a: Array.from({ length: 8 }, () => round((pac / 8 / 0.56) * (0.95 + r() * 0.1), 1)),
      ac_v: [volts, round(volts + 1.5, 1), round(volts - 1, 1)],
      ac_a: Array.from({ length: 3 }, () => round((pac * 1000) / 3 / 230, 1)),
      fac_hz: round(50 + (r() - 0.5) * 0.3, 2), power_factor: 1, temp_c: round(28 + bell * 32 + r() * 2, 1),
      dc_bus_v: 700, power_limit_pct: 110, e_today_kwh: null
    });
  }
  return out;
}

/** Same interface as api/_lib/data/repo.js createRepo(), backed by memory. */
export function createDemoRepo(dataset = createDemoDataset()) {
  const inRange = (key, from, to) => key >= from && key <= to;
  return {
    async dailyRows(from, to) { return dataset.dailyRows.filter((r) => inRange(r.date, from, to)); },
    async bills() { return dataset.bills; },
    async uptimeDays(from, to) { return dataset.uptimeRows.filter((r) => inRange(r.day, from, to)); },
    async segments(from, to) { return dataset.segments.filter((s) => inRange(s.day, from, to)); },
    async alarms(from, to, limit) {
      return dataset.alarmRows.filter((a) => inRange(a.begin_ts.slice(0, 10), addDays(from, -1), addDays(to, 1))).slice(0, limit);
    },
    async telemetryDay(date) { return inRange(date, DEMO.start, addDays(DEMO.today, -1)) ? demoTelemetryDay(date) : []; },
    async settings() { return dataset.settings; }
  };
}

/** Right-now status for the demo, clearly fake. */
export function demoLive() {
  return {
    status: 'online', abnormalOffline: false, faultCode: null,
    currentPowerKw: 21.4, todayKwh: 98.2, totalKwh: 187654,
    dataTimestamp: null, fetchedAt: null, stale: false, demo: true
  };
}
