// tests/alignment.test.js
//
// shared/domain/alignment.js must give the SAME answers as the v1 implementation
// (src/lib/dataService.js) wherever data is complete, and must differ only where v1 broke the
// null ≠ 0 rule or clipped the open period to the 1st of the month (see the header of
// shared/domain/alignment.js). It must also be independent of the machine's timezone, which v1 is not.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { buildAlignedRows, openBillPeriod } from '../shared/domain/alignment.js';
import { eachDateKey } from '../shared/domain/time.js';
import { buildAlignedEnergyComparisonRows } from './fixtures/v1Alignment.js';

function range(startIso, endIso, kwh) {
  const rows = [];
  const cur = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cur <= end) {
    rows.push({ date: cur.toISOString().slice(0, 10), kwh });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return rows;
}
const toV1Daily = (rows) => rows.map((r) => ({ summary_date: r.date, total_generation_kwh: r.kwh }));
const pick = (r) => ({
  month: r.month, period: r.period, inverter: r.inverter, ceb: r.ceb, status: r.status,
  periodStart: r.periodStart, periodEnd: r.periodEnd, billDate: r.billDate
});

const scenarios = {
  'A: two bills, mid-April': {
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-04-18', 100),
    bills: [{ bill_date: '2026-03-05', units_exported: 3000 }, { bill_date: '2026-04-03', units_exported: 3500 }]
  },
  'B: current month awaiting its bill': {
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-04-01', '2026-04-18', 100),
    bills: [{ bill_date: '2026-04-03', units_exported: 3500 }]
  },
  'C: past months with no bill': {
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-04-18', 100),
    bills: [{ bill_date: '2026-04-03', units_exported: 3500 }]
  },
  'D: December maps to a January bill next year': {
    year: 2026, todayKey: '2027-02-01', todayDate: new Date('2027-02-01T10:00:00Z'),
    daily: range('2026-12-01', '2026-12-31', 100),
    bills: [{ bill_date: '2027-01-04', units_exported: 4200 }]
  },
  // E, F and G sit in the gap v1 got wrong (the latest bill is in an earlier month than today), so
  // only their finalized rows are compared with v1; the open period is checked explicitly below.
  'E: a measured zero export': {
    v1OpenPeriodWrong: true,
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-03-31', 100),
    bills: [{ bill_date: '2026-03-05', units_exported: 0 }]
  },
  'F: first bill only → 30-day fallback': {
    v1OpenPeriodWrong: true,
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-04-18', 100),
    bills: [{ bill_date: '2026-03-05', units_exported: 3000 }]
  },
  'G: a different year entirely': {
    v1OpenPeriodWrong: true,
    year: 2025, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2025-01-01', '2025-12-31', 90),
    bills: [{ bill_date: '2025-06-04', units_exported: 3300 }, { bill_date: '2025-07-05', units_exported: 4000 }]
  }
};

describe('matches the v1 implementation wherever data is complete', () => {
  for (const [name, s] of Object.entries(scenarios)) {
    it(name, () => {
      const v3 = buildAlignedRows({ year: s.year, dailyRows: s.daily, bills: s.bills, todayKey: s.todayKey });
      const v1 = buildAlignedEnergyComparisonRows(s.year, toV1Daily(s.daily), s.bills, s.todayDate);
      // Rows where v1 has no daily data at all report inverter 0; v3 correctly reports null.
      const normalise = (rows, isV1) => rows.map((r) => {
        const p = pick(r);
        if (isV1 && p.inverter === 0 && r.status !== 'pending') p.inverter = '__zero_or_null__';
        return p;
      });
      const a = normalise(v3, false).map((r, i) => (r.inverter === null && normalise(v1, true)[i].inverter === '__zero_or_null__' ? { ...r, inverter: '__zero_or_null__' } : r));
      const keep = (_, i) => !s.v1OpenPeriodWrong || v3[i].status === 'finalized';
      expect(a.filter(keep)).toEqual(normalise(v1, true).filter(keep));
      if (s.v1OpenPeriodWrong) expect(v3.filter((r) => r.status === 'finalized').length).toBeGreaterThan(0);
    });
  }
});

describe('null ≠ 0 where v1 broke it', () => {
  const s = scenarios['C: past months with no bill'];
  const rows = buildAlignedRows({ year: s.year, dailyRows: s.daily, bills: s.bills, todayKey: s.todayKey });

  it('a calendar window with no daily data reports inverter null, not 0', () => {
    const noData = buildAlignedRows({ year: 2026, dailyRows: [], bills: [], todayKey: '2026-04-18' });
    expect(noData[0].status).toBe('missing_bill');
    expect(noData[0].inverter).toBeNull();
    expect(noData[0].daysPresent).toBe(0);
    expect(noData[0].daysInPeriod).toBe(31);
    expect(noData[0].completeness).toBe(0); // 0 of 31 days present: informative, not unknown
  });

  it('a measured zero day stays a measured zero', () => {
    const r = buildAlignedRows({ year: 2026, dailyRows: [{ date: '2026-01-10', kwh: 0 }], bills: [], todayKey: '2026-04-18' });
    expect(r[0].inverter).toBe(0);
    expect(r[0].daysPresent).toBe(1);
  });

  it('a bill with null units reports ceb null, while a real 0 stays 0', () => {
    const nul = buildAlignedRows({ year: 2026, dailyRows: [], bills: [{ bill_date: '2026-03-05', units_exported: null }], todayKey: '2026-04-18' });
    expect(nul[1].ceb).toBeNull();
    const zero = buildAlignedRows({ year: 2026, dailyRows: [], bills: [{ bill_date: '2026-03-05', units_exported: 0 }], todayKey: '2026-04-18' });
    expect(zero[1].ceb).toBe(0);
  });

  it('exposes completeness so a partial period is never read as a full one', () => {
    // Bill period 2026-03-06..2026-04-03 is 29 days; give only 22 of them (the real 2025-05-06 shape).
    const partial = range('2026-03-06', '2026-03-27', 100);
    const r = buildAlignedRows({ year: 2026, dailyRows: partial, bills: scenarios["A: two bills, mid-April"].bills, todayKey: s.todayKey });
    const march = r.find((x) => x.month === 'Mar');
    expect(march.daysInPeriod).toBe(29);
    expect(march.daysPresent).toBe(22);
    expect(march.completeness).toBeCloseTo(22 / 29, 10);
    expect(march.inverter).toBe(2200);
    expect(rows.length).toBe(12);
  });

  it('ignores negative / non-finite daily values instead of summing them', () => {
    const r = buildAlignedRows({
      year: 2026, todayKey: '2026-04-18', bills: [],
      dailyRows: [{ date: '2026-01-01', kwh: 100 }, { date: '2026-01-02', kwh: -5 }, { date: '2026-01-03', kwh: NaN }, { date: '2026-01-04', kwh: null }]
    });
    expect(r[0].inverter).toBe(100);
    expect(r[0].daysPresent).toBe(1);
  });
});

describe('real shape: October 2026 awaiting nothing, September finalised by the 3 Oct bill', () => {
  it('maps the 3 Oct bill onto September and keeps October provisional', () => {
    const bills = [
      { bill_date: '2026-09-03', units_exported: 4007 },
      { bill_date: '2026-10-03', units_exported: 3783 }
    ];
    const r = buildAlignedRows({ year: 2026, dailyRows: range('2026-09-04', '2026-10-03', 126), bills, todayKey: '2026-10-03' });
    const sep = r.find((x) => x.month === 'Sep');
    expect(sep).toMatchObject({ status: 'finalized', periodStart: '2026-09-04', periodEnd: '2026-10-03', ceb: 3783, daysInPeriod: 30 });
    const oct = r.find((x) => x.month === 'Oct');
    expect(oct.status).toBe('provisional');
    expect(oct.ceb).toBeNull();
    expect(oct.periodStart).toBe('2026-10-04'); // day after the latest bill
    expect(oct.periodEnd).toBe('2026-10-03'); // today: window not started yet…
    expect(oct.inverter).toBeNull(); // …so no data and no invented zero
    expect(oct.daysInPeriod).toBe(0);
  });
});

describe('the open period runs bill date to bill date, never from the 1st', () => {
  const sepOct = [
    { bill_date: '2026-09-03', units_exported: 4007 },
    { bill_date: '2026-10-03', units_exported: 3783 }
  ];
  const daily = range('2026-09-04', '2027-01-31', 100);
  const find = (rows, month) => rows.find((r) => r.month === month);

  it('3 Nov with the November bill not in yet: October is open from 4 Oct, not November from 1 Nov', () => {
    const r = buildAlignedRows({ year: 2026, dailyRows: daily, bills: sepOct, todayKey: '2026-11-03' });
    expect(find(r, 'Sep')).toMatchObject({ status: 'finalized', periodStart: '2026-09-04', periodEnd: '2026-10-03' });
    expect(find(r, 'Oct')).toMatchObject({ status: 'provisional', periodStart: '2026-10-04', periodEnd: '2026-11-03', ceb: null, inverter: 3100, daysInPeriod: 31, daysPresent: 31 });
    expect(find(r, 'Nov')).toMatchObject({ status: 'pending', period: 'Pending', inverter: null, daysInPeriod: 0 });
    expect(r.filter((x) => x.status === 'provisional')).toHaveLength(1);
    expect(openBillPeriod({ dailyRows: daily, bills: sepOct, todayKey: '2026-11-03' })).toMatchObject({
      month: 'Oct', year: 2026, status: 'provisional', periodStart: '2026-10-04', periodEnd: '2026-11-03',
      lastBillDate: '2026-10-03', inverter: 3100, daysPresent: 31, daysInPeriod: 31
    });
  });

  it('the day after the November bill: October closes on the bill date and November opens', () => {
    const bills = [...sepOct, { bill_date: '2026-11-03', units_exported: 3500 }];
    const r = buildAlignedRows({ year: 2026, dailyRows: daily, bills, todayKey: '2026-11-04' });
    expect(find(r, 'Oct')).toMatchObject({ status: 'finalized', periodStart: '2026-10-04', periodEnd: '2026-11-03', ceb: 3500 });
    expect(find(r, 'Nov')).toMatchObject({ status: 'provisional', periodStart: '2026-11-04', periodEnd: '2026-11-04', inverter: 100, daysInPeriod: 1 });
  });

  it('a bill uploaded late keeps the period open and growing until it arrives', () => {
    const open = openBillPeriod({ dailyRows: daily, bills: sepOct, todayKey: '2026-11-20' });
    expect(open).toMatchObject({ month: 'Oct', periodStart: '2026-10-04', periodEnd: '2026-11-20', daysInPeriod: 48, inverter: 4800 });
  });

  it('New Year: on 2 Jan the open period still starts the day after the December bill', () => {
    const bills = [...sepOct, { bill_date: '2026-11-03', units_exported: 3500 }, { bill_date: '2026-12-03', units_exported: 3400 }];
    const open = openBillPeriod({ dailyRows: daily, bills, todayKey: '2027-01-02' });
    expect(open).toMatchObject({ month: 'Dec', year: 2026, periodStart: '2026-12-04', periodEnd: '2027-01-02', daysInPeriod: 30, inverter: 3000 });
    // The calendar-year view of 2027 has no open row; that is why the API returns the open period on its own.
    const y2027 = buildAlignedRows({ year: 2027, dailyRows: daily, bills, todayKey: '2027-01-02' });
    expect(y2027.find((x) => x.status === 'provisional')).toBeUndefined();
    expect(find(y2027, 'Jan')).toMatchObject({ status: 'pending', inverter: null });
    const y2026 = buildAlignedRows({ year: 2026, dailyRows: daily, bills, todayKey: '2027-01-02' });
    expect(find(y2026, 'Dec')).toMatchObject({ status: 'provisional', periodStart: '2026-12-04', periodEnd: '2027-01-02' });
  });

  it('several months without a bill: one open period from the latest bill; the months between await it', () => {
    const bills = [{ bill_date: '2026-07-04', units_exported: 3900 }];
    const r = buildAlignedRows({ year: 2026, dailyRows: range('2026-06-01', '2026-11-03', 100), bills, todayKey: '2026-11-03' });
    expect(find(r, 'Jul')).toMatchObject({ status: 'provisional', periodStart: '2026-07-05', periodEnd: '2026-11-03', daysInPeriod: 122 });
    for (const m of ['Aug', 'Sep', 'Oct']) expect(find(r, m)).toMatchObject({ status: 'pending', period: 'Awaiting bill', inverter: null, daysInPeriod: 0 });
    expect(find(r, 'Nov')).toMatchObject({ status: 'pending', period: 'Pending' });
  });

  it('no day is counted twice, and every day from the first bill period to today is counted once', () => {
    // The real 2026 shape: bills missing from May to August, plus a 2025 bill long before.
    const bills = [
      { bill_date: '2025-06-04', units_exported: 3300 },
      { bill_date: '2026-04-03', units_exported: 4813 },
      { bill_date: '2026-09-03', units_exported: 4007 },
      { bill_date: '2026-10-03', units_exported: 3783 }
    ];
    const todayKey = '2026-11-03';
    const dailyRows = range('2025-01-01', todayKey, 100);
    const seen = new Map();
    for (const year of [2025, 2026]) {
      for (const row of buildAlignedRows({ year, dailyRows, bills, todayKey })) {
        if (!row.periodStart) continue;
        for (const d of eachDateKey(row.periodStart, row.periodEnd)) seen.set(d, (seen.get(d) ?? 0) + 1);
      }
    }
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    for (const d of eachDateKey('2025-05-05', todayKey)) expect(seen.get(d), d).toBe(1);
    // A past month with no bill whose days sit inside a later bill's period carries no figure of its own.
    const y2026 = buildAlignedRows({ year: 2026, dailyRows, bills, todayKey });
    expect(find(y2026, 'Apr')).toMatchObject({ status: 'missing_bill', period: 'Covered by a later bill', inverter: null, periodStart: null });
    // Before the first bill period nothing covers the days, so the calendar month still counts them.
    const y2025 = buildAlignedRows({ year: 2025, dailyRows, bills, todayKey });
    expect(find(y2025, 'Jan')).toMatchObject({ status: 'missing_bill', periodStart: '2025-01-01', periodEnd: '2025-01-31', inverter: 3100 });
  });
});

describe('timezone independence (v1 is not)', () => {
  it('produces byte-identical rows under three very different TZ settings', () => {
    const s = scenarios['A: two bills, mid-April'];
    const script = `
      import { buildAlignedRows } from ${JSON.stringify(new URL('../shared/domain/alignment.js', import.meta.url).href)};
      const input = ${JSON.stringify({ year: s.year, dailyRows: s.daily, bills: s.bills, todayKey: s.todayKey })};
      process.stdout.write(JSON.stringify(buildAlignedRows(input)));`;
    const outputs = ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Colombo'].map((tz) => {
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      return r.stdout;
    });
    expect(new Set(outputs).size).toBe(1);
  });
});
