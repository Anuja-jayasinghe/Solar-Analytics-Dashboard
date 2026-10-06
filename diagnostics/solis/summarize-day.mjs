// Aggregate private inverterDay responses without printing identifiers or raw records.
import { readFileSync } from 'node:fs';

const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass one or more private inverterDay.json files.');
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const number = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const rounded = (value) => value === null ? null : Math.round(value * 100) / 100;

for (const file of paths) {
  const response = JSON.parse(readFileSync(file, 'utf8'));
  const rows = response?.data;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected nonempty inverterDay data.');
  const times = rows.map((row) => number(row.dataTimestamp)).filter((value) => value !== null).sort((a, b) => a - b);
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(times[0]));
  const live = rows.filter((row) => row.pacStr === 'kW' && number(row.pac) !== null && number(row.pacPec) !== null && number(row.pac) * number(row.pacPec) > 1);
  const amps = Array.from({ length: 8 }, (_, index) => mean(live.map((row) => number(row[`iPv${index + 1}`])).filter((value) => value !== null)));
  const grandMean = mean(amps.filter((value) => value !== null));
  const flagged = amps.flatMap((value, index) => value !== null && grandMean > 0 && value / grandMean - 1 < -0.08 ? [index + 1] : []);
  const matches = [[1, 2], [3, 4], [5, 6], [7, 8]].map(([a, b]) => live.filter((row) => number(row[`uPv${a}`]) === number(row[`uPv${b}`])).length);
  const pairedRatio = live.flatMap((row) => {
    const pac = number(row.pac) * number(row.pacPec);
    const a = number(row.iPv5);
    const b = number(row.iPv6);
    return pac > 10 && a > 1 && b > 1 ? [a / b] : [];
  });
  const acSpread = live.flatMap((row) => {
    const phases = [1, 2, 3].map((index) => number(row[`uAc${index}`]));
    return phases.every((value) => value !== null) ? [Math.max(...phases) - Math.min(...phases)] : [];
  });
  const gaps = times.slice(1).map((value, index) => (value - times[index]) / 60000);
  console.log(JSON.stringify({
    date: localDate,
    records: rows.length,
    producing: live.length,
    currentMeanA: amps.map(rounded),
    dashboardFlagged: flagged,
    equalVoltagePairSamples: matches,
    pv7VoltageMedian: rounded(median(live.map((row) => number(row.uPv7)).filter((value) => value !== null))),
    pairedPv5Pv6CurrentRatioMedianAbove10Kw: rounded(median(pairedRatio)),
    acVoltageSpreadMedian: rounded(median(acSpread)),
    largestSampleGapMinutes: rounded(gaps.length ? Math.max(...gaps) : null)
  }));
}
