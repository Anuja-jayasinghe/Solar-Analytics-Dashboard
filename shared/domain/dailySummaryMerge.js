// shared/domain/dailySummaryMerge.js
//
// How a freshly computed daily-summary row is merged into the stored one. Pure: no I/O.
// Used by functions/generate_daily_summary; tests/dailySummaryMerge.test.js.
//
// Two measurements, two rules:
//
// - total_generation_kwh comes from the inverter's own `generation_today` counter, which only RISES
//   during a day. A recomputed total LOWER than the stored one therefore means the job saw
//   incomplete data (rows pruned, a late run), not a correction: it is blocked, not written.
//
// - peak_power_kw is the highest AC power anyone measured that day. The 5-minute live job only
//   sees whatever moments GitHub's cron happened to run it — since mid-October 2026 two to five a
//   day — so its maximum is a sample, often far below the real peak (5.12 kW stored against a
//   real 33.52 kW on 2026-10-21). The nightly telemetry collector raises it from SolisCloud's full
//   5-minute history (functions/collect_telemetry, --fill-peaks). Every value is a real reading,
//   so the honest peak is the HIGHEST of them: a merge never lowers a stored peak. The rule this
//   replaces — "block the whole update if the peak dropped by more than 5 kW" — blocked
//   legitimate generation updates once peaks were corrected from telemetry.

/** A total more than this below the stored one is treated as incomplete data. */
export const GENERATION_DROP_TOLERANCE_KWH = 1.5;

const EPSILON = 0.01;
const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** The higher of two peaks; null only when both are unknown. */
export function higherPeak(a, b) {
  const x = num(a);
  const y = num(b);
  if (x === null) return y;
  if (y === null) return x;
  return Math.max(x, y);
}

/**
 * @param {{total_generation_kwh:number, peak_power_kw:number|null}|null|undefined} existing  stored row
 * @param {{inverter_sn:string, summary_date:string, total_generation_kwh:number, peak_power_kw:number|null}} computed
 * @returns {{action:'insert'|'update'|'unchanged'|'blocked_generation_drop', row?:object, reason?:string}}
 */
export function mergeDailySummary(existing, computed) {
  if (!existing) return { action: 'insert', row: computed };

  const storedKwh = num(existing.total_generation_kwh);
  const newKwh = num(computed.total_generation_kwh);
  if (storedKwh !== null && newKwh !== null && newKwh < storedKwh - GENERATION_DROP_TOLERANCE_KWH) {
    return {
      action: 'blocked_generation_drop',
      reason: `generation fell from ${storedKwh} to ${newKwh} kWh; the day's counter only rises, so the data is incomplete`
    };
  }

  const peak = higherPeak(existing.peak_power_kw, computed.peak_power_kw);
  const row = { ...computed, peak_power_kw: peak };
  const genChanged = storedKwh === null || newKwh === null ? storedKwh !== newKwh : Math.abs(storedKwh - newKwh) > EPSILON;
  const storedPeak = num(existing.peak_power_kw);
  const peakChanged = storedPeak === null ? peak !== null : Math.abs(storedPeak - (peak ?? storedPeak)) > EPSILON;

  return genChanged || peakChanged ? { action: 'update', row } : { action: 'unchanged' };
}
