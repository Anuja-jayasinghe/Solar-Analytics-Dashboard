// Bounded daily summaries of stored inverter telemetry for the Pro electrical range view.
// A missing day stays unknown; only samples above 1 kW enter electrical statistics.

import { eachDateKey, localDateKey } from './time.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const number = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const mean = (values) => values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function electricalValues(points) {
  const producing = points.filter((p) => number(p.pac_kw) > 1);
  const entries = (field, index) => producing.map((p) => number(p[field]?.[index])).filter(finite);
  const inputCount = Math.max(0, ...producing.map((p) => Array.isArray(p.pv_a) ? p.pv_a.length : 0));
  const pvInputs = Array.from({ length: inputCount }, (_, i) => ({
    n: i + 1,
    amps: mean(entries('pv_a', i)),
    volts: mean(entries('pv_v', i))
  }));
  const acPhaseVolts = [0, 1, 2].map((i) => median(entries('ac_v', i)));
  const spreads = producing.flatMap((p) => {
    const phases = [0, 1, 2].map((i) => number(p.ac_v?.[i]));
    return phases.every(finite) ? [Math.max(...phases) - Math.min(...phases)] : [];
  });
  const temps = producing.map((p) => number(p.temp_c)).filter(finite);
  const frequencies = producing.map((p) => number(p.fac_hz)).filter(finite);
  const factors = producing.map((p) => number(p.power_factor)).filter(finite);
  return {
    samples: points.length,
    producingSamples: producing.length,
    pvInputs,
    acPhaseVolts,
    acPhaseSpreadVolts: median(spreads),
    temperatureMaxC: temps.length ? Math.max(...temps) : null,
    frequencyLoHz: frequencies.length ? Math.min(...frequencies) : null,
    frequencyHiHz: frequencies.length ? Math.max(...frequencies) : null,
    powerFactor: mean(factors)
  };
}

export function summarizeElectricalRange(points, from, to) {
  const byDay = new Map(eachDateKey(from, to).map((date) => [date, []]));
  for (const point of points ?? []) {
    const ms = Date.parse(point?.ts);
    if (!Number.isFinite(ms)) continue;
    const date = localDateKey(ms);
    if (byDay.has(date)) byDay.get(date).push(point);
  }
  const days = [...byDay].map(([date, rows]) => ({ date, ...electricalValues(rows) }));
  const all = days.flatMap((d) => byDay.get(d.date));
  return {
    from, to,
    days,
    summary: {
      ...electricalValues(all),
      daysWithTelemetry: days.filter((d) => d.samples > 0).length,
      daysProducing: days.filter((d) => d.producingSamples > 0).length,
      daysRequested: days.length
    }
  };
}
