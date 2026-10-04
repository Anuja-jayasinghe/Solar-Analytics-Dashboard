import { demoRequest } from 'file:///C:/gitprojects/Solar-Analytics-Dashboard/shared/demo/demoApi.js';
import { createDemoDataset, DEMO } from 'file:///C:/gitprojects/Solar-Analytics-Dashboard/shared/demo/demoData.js';
import { computeEarningsDifference } from 'file:///C:/gitprojects/Solar-Analytics-Dashboard/shared/domain/earningsDifference.js';
import fs from 'node:fs';
const main = JSON.parse(fs.readFileSync('main_data.json', 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10;
const loc = (ts) => new Date(Date.parse(ts) + 330 * 60000);

// hourly kWh (local 05..19) + peak per day, from the real demo telemetry
const T0 = Date.parse(main.start + 'T00:00:00Z');
const hourly = []; const peaks = [];
for (let i = 0; i < main.days.length; i++) {
  if (main.days[i] === null) { hourly.push(null); peaks.push(null); continue; }
  const k = new Date(T0 + i * 86400000).toISOString().slice(0, 10);
  const pts = (await demoRequest('telemetry', { date: k })).body.points;
  const h = new Array(15).fill(0); let pk = { kw: 0, t: '' };
  for (let j = 0; j < pts.length; j++) {
    const p = pts[j]; const lm = loc(p.ts); const hh = lm.getUTCHours();
    const dt = j + 1 < pts.length ? Math.min(10, (Date.parse(pts[j + 1].ts) - Date.parse(p.ts)) / 60000) : 5;
    if (hh >= 5 && hh <= 19) h[hh - 5] += (p.pac_kw || 0) * dt / 60;
    if (p.pac_kw > pk.kw) pk = { kw: r1(p.pac_kw), t: String(hh).padStart(2, '0') + ':' + String(lm.getUTCMinutes()).padStart(2, '0') };
  }
  hourly.push(h.map(r1)); peaks.push(pk);
}

// earnings difference (LR-004)
const bills = (await demoRequest('bills')).body.bills;
const ed = computeEarningsDifference(bills);
const billRows = bills.map((b) => ({ s: b.periodStart, e: b.periodEnd, rate: b.effectiveRatePerKwh, earn: b.earningsLkr, ceb: b.cebKwh, inv: b.inverterKwh === null ? null : Math.round(b.inverterKwh), ok: b.complete, d: b.complete && b.cebKwh > 0 ? Math.round((b.inverterKwh - b.cebKwh) * b.earningsLkr / b.cebKwh) : null })).reverse().reverse();

// pro: uptime, alarms, electrical
const up = (await demoRequest('uptime', { from: '2036-07-17', to: '2036-09-14' })).body;
const upDays = up.days.map((d) => ({ d: d.day, p: d.uptime_pct, st: d.status, trip: d.trip_min, gap: d.gap_min, comms: d.comms_lost_min, tc: d.trip_count }));
const al = (await demoRequest('alarms', { from: '2036-01-01', to: '2036-09-14', limit: 60 })).body;
const alarms = al.alarms.slice(0, 40).map((a) => ({ code: a.alarm_code, msg: a.message, at: a.begin_ts, min: Math.round((a.duration_ms || 0) / 6000) / 10, lvl: a.level, adv: a.advice, open: a.end_ts === null }));
const tele = (await demoRequest('telemetry', { date: '2036-09-14' })).body.points.filter((p) => p.pac_kw > 1);
const nS = tele[0].pv_a.length;
const avg = (f) => tele.reduce((s, p) => s + f(p), 0) / tele.length;
const strings = Array.from({ length: nS }, (_, i) => ({ n: i + 1, a: r1(avg((p) => p.pv_a[i])), v: Math.round(avg((p) => p.pv_v[i])) }));
const byHour = {};
for (const p of tele) { const hh = loc(p.ts).getUTCHours(); (byHour[hh] ||= []).push(p); }
const hrs = Object.keys(byHour).map(Number).sort((a, b) => a - b);
const temp = hrs.map((h) => ({ h, v: r1(Math.max(...byHour[h].map((p) => p.temp_c))) }));
const fac = hrs.map((h) => ({ h, lo: Math.min(...byHour[h].map((p) => p.fac_hz)), hi: Math.max(...byHour[h].map((p) => p.fac_hz)) }));
const pf = r1(avg((p) => p.power_factor) * 100) / 100;
const acv = Math.round(avg((p) => (p.ac_v[0] + p.ac_v[1] + p.ac_v[2]) / 3));
// revenue lost estimate: (trip+gap minutes) x that day's kWh per window-minute x rate
let lostKwh = 0; let lostLkr = 0;
for (const d of up.days) {
  const i = Math.round((Date.parse(d.day + 'T00:00:00Z') - T0) / 86400000); const kwh = main.days[i];
  if (kwh === null || !d.window_minutes) continue;
  const m = (d.trip_min || 0) + (d.gap_min || 0); const k = m * kwh / d.window_minutes; lostKwh += k;
  const rate = (main.bills.find((b) => b.s <= d.day && d.day <= b.e) || main.bills[main.bills.length - 1]).r; lostLkr += k * rate;
}
const out = {
  hourly, peaks, ed: { diff: Math.round(ed.differenceLkr), pct: Math.round(ed.differencePct * 100) / 100, earn: Math.round(ed.earningsLkr), value: Math.round(ed.inverterValueLkr), n: ed.includedPeriods, excl: ed.excluded.length, from: ed.from, to: ed.to },
  billRows,
  pro: { agg: up.aggregate, upDays, alarms, alarmCount: al.count, byCode: al.byCode, strings, temp, fac, pf, acv, lostKwh: Math.round(lostKwh), lostLkr: Math.round(lostLkr), cap: DEMO.capacityKwp }
};
fs.writeFileSync('extra_data.json', JSON.stringify(out));
console.log('extra', (JSON.stringify(out).length / 1024).toFixed(1) + ' KB', out.ed, out.pro.agg, out.pro.strings.length, alarms.length, out.pro.lostKwh, out.pro.lostLkr, JSON.stringify(out.pro.byCode).slice(0,200));
