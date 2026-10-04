// Real demo-dataset figures for the interactive dashboard board (all dates 2035+).
import { demoRequest } from 'file:///C:/gitprojects/Solar-Analytics-Dashboard/shared/demo/demoApi.js';
import { createDemoDataset, DEMO } from 'file:///C:/gitprojects/Solar-Analytics-Dashboard/shared/demo/demoData.js';

const ds = createDemoDataset();

const rowsFor = async (y) => (await demoRequest('comparison', { year: y })).body.rows
  .filter((r) => r.status !== 'pending')
  .map((r) => ({
    m: r.month, y, st: r.status,
    inv: r.inverter === null ? null : Math.round(r.inverter),
    ceb: r.ceb, dp: r.daysPresent, dn: r.daysInPeriod,
    ps: r.periodStart, pe: r.periodEnd
  }));
const monthly = [...(await rowsFor(2035)), ...(await rowsFor(2036))];

// daily series from the first demo day to the day before "today", null = no row (unknown, not zero)
const byDate = new Map(ds.dailyRows.map((r) => [r.date, r.kwh]));
const start = DEMO.start;
const days = [];
for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= '2036-09-14'; d.setUTCDate(d.getUTCDate() + 1)) {
  const k = d.toISOString().slice(0, 10);
  days.push(byDate.has(k) ? byDate.get(k) : null);
}

const bills = (await demoRequest('bills')).body.bills.map((b) => ({ s: b.periodStart, e: b.periodEnd, r: Math.round(b.effectiveRatePerKwh * 100) / 100, earn: b.earningsLkr, ceb: b.cebKwh }));
const totalGen = Math.round(days.reduce((s, v) => s + (v ?? 0), 0));
const totalEarn = bills.reduce((s, b) => s + (b.earn ?? 0), 0);

// "today so far" peak: the demo's last full telemetry day up to 14:00 local
const tele = (await demoRequest('telemetry', { date: '2036-09-14' })).body.points;
let peak = { kw: 0, t: '' };
for (const p of tele) {
  const lm = new Date(Date.parse(p.ts) + 330 * 60000);
  const hh = lm.getUTCHours() + lm.getUTCMinutes() / 60;
  if (hh <= 14 && p.pac_kw > peak.kw) peak = { kw: Math.round(p.pac_kw * 10) / 10, t: `${String(lm.getUTCHours()).padStart(2, '0')}:${String(lm.getUTCMinutes()).padStart(2, '0')}` };
}

const lastBill = bills[bills.length - 1];
const prov = monthly[monthly.length - 1];
process.stdout.write(JSON.stringify({
  start, daysEnd: '2036-09-14', days, monthly, bills,
  kpi: { totalGenKwh: totalGen, totalEarnLkr: totalEarn, billCount: bills.length, billPeriodStart: prov.ps, billPeriodKwh: prov.inv, billPeriodDays: prov.dp, billPeriodOf: prov.dn },
  live: { kw: 21.4, todayKwh: 98.2, target: 150, capKw: 45 },
  peak, capacityKwp: DEMO.capacityKwp, today: DEMO.today, lastBillRate: lastBill.r
}));
