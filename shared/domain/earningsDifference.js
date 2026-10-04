// shared/domain/earningsDifference.js
//
// LR-004: CEB vs inverter earnings difference (CEB paid minus inverter value; negative = CEB paid less),
// per bill period at that bill's own rate.
// Spec: docs/logic-registry/LR-004-earnings-difference.md
// Tests: tests/earningsDifference.test.js
//
// Pure: no I/O, no clock. Input rows are the `bills` resource rows (see shared/data/resources.js).
// An ineligible period is excluded and counted, never given a difference of 0.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Why a bill row cannot be priced, or null when it is eligible.
 * @param {object} b a row from the `bills` resource
 */
export function exclusionReason(b) {
  if (!b || b.inverterKwh === null || b.inverterKwh === undefined || !finite(b.inverterKwh)) return 'no_inverter_data';
  if (!finite(b.cebKwh) || !(b.cebKwh > 0) || !finite(b.earningsLkr)) return 'no_rate';
  if (!b.complete) return 'incomplete_days';
  return null;
}

/**
 * @param {object[]} bills rows with billDate, periodStart, periodEnd, cebKwh, earningsLkr, inverterKwh, complete
 * @returns {{differenceLkr:number|null, differencePct:number|null, earningsLkr:number|null,
 *            inverterValueLkr:number|null, includedPeriods:number, excluded:{billDate:string,reason:string}[],
 *            periods:{billDate:string,rate:number,differenceLkr:number}[], from:string|null, to:string|null}}
 */
export function computeEarningsDifference(bills) {
  const periods = [];
  const excluded = [];
  let earnings = 0;
  let value = 0;
  let from = null;
  let to = null;

  for (const b of bills ?? []) {
    const reason = exclusionReason(b);
    if (reason) {
      excluded.push({ billDate: b?.billDate ?? null, reason });
      continue;
    }
    const rate = b.earningsLkr / b.cebKwh;
    const diff = (b.cebKwh - b.inverterKwh) * rate;
    periods.push({ billDate: b.billDate, rate, differenceLkr: diff });
    earnings += b.earningsLkr;
    value += b.inverterKwh * rate;
    if (b.periodStart && (from === null || b.periodStart < from)) from = b.periodStart;
    if (b.periodEnd && (to === null || b.periodEnd > to)) to = b.periodEnd;
  }

  if (periods.length === 0) {
    return { differenceLkr: null, differencePct: null, earningsLkr: null, inverterValueLkr: null, includedPeriods: 0, excluded, periods, from, to };
  }
  const differenceLkr = earnings - value;
  return {
    differenceLkr,
    differencePct: value > 0 ? (differenceLkr / value) * 100 : null,
    earningsLkr: earnings,
    inverterValueLkr: value,
    includedPeriods: periods.length,
    excluded,
    periods,
    from,
    to
  };
}
