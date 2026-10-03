// tests/alignment.test.js
//
// shared/domain/alignment.js must give the SAME answers as the v1 implementation
// (src/lib/dataService.js) wherever data is complete, and must differ only where v1 broke the
// null ≠ 0 rule. It must also be independent of the machine's timezone, which v1 is not.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { buildAlignedRows } from '../shared/domain/alignment.js';
import { buildAlignedEnergyComparisonRows } from '../src/lib/dataService.js';

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
  'E: a measured zero export': {
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-03-31', 100),
    bills: [{ bill_date: '2026-03-05', units_exported: 0 }]
  },
  'F: first bill only → 30-day fallback': {
    year: 2026, todayKey: '2026-04-18', todayDate: new Date('2026-04-18T10:00:00Z'),
    daily: range('2026-01-01', '2026-04-18', 100),
    bills: [{ bill_date: '2026-03-05', units_exported: 3000 }]
  },
  'G: a different year entirely': {
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
      expect(a).toEqual(normalise(v1, true));
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
