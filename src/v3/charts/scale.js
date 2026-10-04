// src/v3/charts/scale.js
//
// Pure chart maths shared by every v3 chart: "nice" axis maxima, tick labels, and SVG paths that break
// at unknown values. A null point is a GAP in a line, never a point at zero.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Round a maximum up to a tidy axis end (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 or 10 times a power of ten), close enough that the bars use the height. */
export function niceMax(v) {
  if (!isNum(v) || v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => f <= s + 1e-9);
  return n * p;
}

/** Five evenly spaced ticks 0..max, top first, each with its position as a percent of the plot height. */
export function axisTicks(max, fmt = (n) => String(Math.round(n))) {
  return [4, 3, 2, 1, 0].map((i) => ({ value: (max * i) / 4, label: fmt((max * i) / 4), pct: i * 25 }));
}

/** Largest finite value in a list of numbers/nulls, or `fallback` when there is none. */
export function maxOf(values, fallback = 0) {
  let m = null;
  for (const v of values) if (isNum(v) && (m === null || v > m)) m = v;
  return m === null ? fallback : m;
}

/**
 * SVG path through [x, y] points (both 0..100); a null point lifts the pen, so an unknown day or period
 * leaves a visible break instead of dipping to zero.
 */
export function linePath(points) {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p === null || p === undefined) { pen = false; continue; }
    d += `${pen ? ' L ' : ' M '}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    pen = true;
  }
  return d.trim();
}

/** Closed area under the known points (first to last), down to the baseline y=100. Empty when nothing is known. */
export function areaPath(points) {
  const ok = points.filter((p) => p !== null && p !== undefined);
  if (ok.length === 0) return '';
  const first = ok[0];
  const last = ok[ok.length - 1];
  return `M ${first[0].toFixed(2)} 100 L ${ok.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ')} L ${last[0].toFixed(2)} 100 Z`;
}

/** Value -> y percent from the top of a plot that runs 0..max (0 at the bottom). */
export function yPct(value, max) {
  return 100 - clamp((value / max) * 100, 0, 100);
}

/** Column centre as an x percent for index i of n equal columns. */
export function xPct(i, n) {
  return ((i + 0.5) / n) * 100;
}

/** Pointer position within a plot (clientY, rect top/height) -> a value on a 0..max axis, snapped to `step`. */
export function valueFromPointer(clientY, rectTop, rectHeight, max, step = 1) {
  if (!isNum(rectHeight) || rectHeight <= 0) return null;
  const frac = clamp(1 - (clientY - rectTop) / rectHeight, 0, 1);
  return Math.round((frac * max) / step) * step;
}

/**
 * A smooth curve (Catmull-Rom converted to cubic Béziers) through [x, y] points on a 0..100 grid. Control
 * points are kept inside 0..100 so a curve never dips below the baseline. Needs known points only:
 * use it for continuous measurements such as hourly output, not for gappy daily data.
 */
export function smoothPath(points) {
  if (points.length === 0) return '';
  if (points.length < 3) return linePath(points);
  const c = (v) => clamp(v, 0, 100);
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    d += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${c(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${c(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Labels above bars/points are drawn when there is room: off beyond this many columns. */
export const MAX_LABELLED_COLUMNS = 40;

/**
 * The small number printed above a bar or point: just the value, no unit. Compact ("4.2k") when the chart is
 * crowded and the value is large; one decimal below 10. Unknown prints nothing (never "0").
 */
export function chartNum(v, { dense = false } = {}) {
  if (!isNum(v)) return '';
  const a = Math.abs(v);
  if (dense && a >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString('en-US', { maximumFractionDigits: a < 10 ? 1 : 0, minimumFractionDigits: 0 });
}
