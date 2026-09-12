// tests/energyAlignment.test.js
//
// Covers LR-001 — the CEB vs inverter monthly alignment rule, which is the core business
// logic of the whole dashboard. The spec lives at
// docs/logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md and ends with a list of
// acceptance criteria; this file is those criteria, executable.
//
// The rule in one line: a bill received in month N reports generation from month N-1.
//
// The semantic distinction matters more than it looks:
//   null = unavailable / pending
//   0    = an actual measured zero
// Conflating them is what produced the fabricated peak-power zeros found in the 2026 audit.

import { describe, it, expect } from 'vitest';
import { buildAlignedEnergyComparisonRows } from '../src/lib/dataService.js';

/** Build daily rows of a constant value across an inclusive date range. */
function dailyRange(startIso, endIso, kwhPerDay) {
  const rows = [];
  const cur = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cur <= end) {
    rows.push({
      summary_date: cur.toISOString().slice(0, 10),
      total_generation_kwh: kwhPerDay
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return rows;
}

const byMonth = (rows, label) => rows.find((r) => r.month === label);

describe('LR-001 — bill in month N maps to generation in month N-1', () => {
  // Worked Example A from the spec: today = 2026-04-18, last bill = 2026-04-03.
  const today = new Date('2026-04-18T10:00:00Z');
  const bills = [
    { bill_date: '2026-03-05', units_exported: 3000 },
    { bill_date: '2026-04-03', units_exported: 3500 }
  ];
  const daily = dailyRange('2026-01-01', '2026-04-18', 100);
  const rows = buildAlignedEnergyComparisonRows(2026, daily, bills, today);

  it('returns exactly twelve month rows', () => {
    expect(rows).toHaveLength(12);
  });

  it('maps the April bill onto March generation', () => {
    const march = byMonth(rows, 'Mar');
    expect(march.status).toBe('finalized');
    expect(march.ceb).toBe(3500); // the 3 Apr bill, not the 5 Mar one
    expect(march.billDate).toBe('2026-04-03');
  });

  it('ends the period on the bill date and starts it the day after the previous bill', () => {
    const march = byMonth(rows, 'Mar');
    expect(march.periodEnd).toBe('2026-04-03');
    expect(march.periodStart).toBe('2026-03-06'); // 2026-03-05 + 1 day
  });

  it('sums inverter generation across exactly that window, not the calendar month', () => {
    // 2026-03-06 .. 2026-04-03 inclusive = 29 days at 100 kWh
    expect(byMonth(rows, 'Mar').inverter).toBe(2900);
  });

  it('falls back to a 30-day window when there is no previous bill', () => {
    const single = buildAlignedEnergyComparisonRows(
      2026,
      daily,
      [{ bill_date: '2026-03-05', units_exported: 3000 }],
      today
    );
    const feb = byMonth(single, 'Feb');
    expect(feb.status).toBe('finalized');
    expect(feb.periodEnd).toBe('2026-03-05');
    expect(feb.periodStart).toBe('2026-02-03'); // bill date - 30 days
  });
});

describe('LR-001 — the current month before its bill arrives (Example B)', () => {
  const today = new Date('2026-04-18T10:00:00Z');
  const bills = [{ bill_date: '2026-04-03', units_exported: 3500 }];
  const daily = dailyRange('2026-04-01', '2026-04-18', 100);
  const rows = buildAlignedEnergyComparisonRows(2026, daily, bills, today);
  const april = byMonth(rows, 'Apr');

  it('is provisional, not finalized', () => {
    expect(april.status).toBe('provisional');
  });

  it('reports ceb as null — unavailable, not zero', () => {
    expect(april.ceb).toBeNull();
    expect(april.ceb).not.toBe(0);
  });

  it('still shows inverter progress for the partial period', () => {
    // starts the day after the latest bill (2026-04-04) and runs to today (2026-04-18)
    expect(april.periodStart).toBe('2026-04-04');
    expect(april.periodEnd).toBe('2026-04-18');
    expect(april.inverter).toBe(1500); // 15 days at 100
  });
});

describe('LR-001 — future months (Example C)', () => {
  const rows = buildAlignedEnergyComparisonRows(
    2026,
    dailyRange('2026-01-01', '2026-04-18', 100),
    [{ bill_date: '2026-04-03', units_exported: 3500 }],
    new Date('2026-04-18T10:00:00Z')
  );

  it('reports both sides as null and a Pending label', () => {
    for (const label of ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      const row = byMonth(rows, label);
      expect(row.status).toBe('pending');
      expect(row.inverter).toBeNull();
      expect(row.ceb).toBeNull();
      expect(row.period).toBe('Pending');
    }
  });
});

describe('LR-001 — a past month with no bill', () => {
  const rows = buildAlignedEnergyComparisonRows(
    2026,
    dailyRange('2026-01-01', '2026-04-18', 100),
    [{ bill_date: '2026-04-03', units_exported: 3500 }],
    new Date('2026-04-18T10:00:00Z')
  );

  it('is marked missing_bill and does NOT pretend the value is zero', () => {
    const jan = byMonth(rows, 'Jan');
    expect(jan.status).toBe('missing_bill');
    expect(jan.ceb).toBeNull();
    expect(jan.ceb).not.toBe(0);
  });

  it('still reports inverter generation for the calendar month', () => {
    expect(byMonth(rows, 'Jan').inverter).toBe(3100); // 31 days at 100
  });
});

describe('LR-001 — edge cases', () => {
  it('a true measured zero export is 0, not null', () => {
    const rows = buildAlignedEnergyComparisonRows(
      2026,
      dailyRange('2026-01-01', '2026-03-31', 100),
      [{ bill_date: '2026-03-05', units_exported: 0 }],
      new Date('2026-04-18T10:00:00Z')
    );
    const feb = byMonth(rows, 'Feb');
    expect(feb.status).toBe('finalized');
    expect(feb.ceb).toBe(0);
    expect(feb.ceb).not.toBeNull();
  });

  it('December generation maps to a January bill in the following year', () => {
    const rows = buildAlignedEnergyComparisonRows(
      2026,
      dailyRange('2026-12-01', '2026-12-31', 100),
      [{ bill_date: '2027-01-04', units_exported: 4200 }],
      new Date('2027-02-01T10:00:00Z')
    );
    const dec = byMonth(rows, 'Dec');
    expect(dec.status).toBe('finalized');
    expect(dec.ceb).toBe(4200);
  });

  it('does not throw on empty inputs', () => {
    expect(() => buildAlignedEnergyComparisonRows(2026, [], [], new Date())).not.toThrow();
    expect(() => buildAlignedEnergyComparisonRows(2026, null, null, new Date())).not.toThrow();
  });
});
