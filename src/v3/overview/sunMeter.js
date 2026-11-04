// src/v3/overview/sunMeter.js
//
// Geometry for the live power gauge, a rising sun: 40 rays fanned over the horizon, left (0 kW) to right (the
// inverter's maximum), one ray per 2.5% of it. Lit rays are the live output and the last five are the red zone near
// the maximum. Today's peak is marked on the scale like a cruise-control set point: a line across the scale and a
// small arrow pointing at it. Pure: no React, no clock. Coordinates are in the SVG's user space, with (0, 0) at the
// centre of the horizon and y going up as negative numbers.

export const RAYS = 40;
export const RED_FROM = 35; // rays 35..39: the last 12.5% before the maximum
export const SUN_R = 66; // the sun's half disc
export const RAY_IN = 78; // where a ray starts
export const RAY_OUT = 120; // a lit ray's tip
export const RAY_OUT_DIM = 108; // an unlit ray's tip (shorter: the sun is not reaching there)
export const SCALE_R = 132; // the thin scale arc the peak marker sits on
export const LABEL_R = 152;
export const VIEWBOX = '-170 -172 340 196';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** A point at `share` (0 = left horizon, 1 = right horizon) and radius `r`. */
export function at(share, r) {
  const a = Math.PI * (1 - clamp01(share));
  return { x: +(Math.cos(a) * r).toFixed(2), y: +(-Math.sin(a) * r).toFixed(2) };
}

/** The 40 rays, each centred on its slice of the scale: { i, inner, outer, outerDim, red }. */
export function rays() {
  return Array.from({ length: RAYS }, (_, i) => {
    const s = (i + 0.5) / RAYS;
    return { i, inner: at(s, RAY_IN), outer: at(s, RAY_OUT), outerDim: at(s, RAY_OUT_DIM), red: i >= RED_FROM };
  });
}

/**
 * How lit each ray is (0..1) for a share of the maximum (0..1). Full rays up to the reading, the next one partly
 * (so a count-up sweeps smoothly), the rest dark. Unknown power lights nothing.
 */
export function rayLevels(share) {
  const lit = isNum(share) ? clamp01(share) * RAYS : 0;
  return Array.from({ length: RAYS }, (_, i) => clamp01(lit - i));
}

/** The peak marker's rotation in degrees around the horizon centre: -90 points at 0 kW, +90 at the maximum. */
export function peakAngle(share) {
  return isNum(share) ? +(clamp01(share) * 180 - 90).toFixed(2) : null;
}

/**
 * Scale labels on round steps (10 kW for a 40 kW inverter: '0', '10', '20', '30', '40 kW'), always ending on the
 * maximum itself; a step too close to the maximum is dropped so the two labels never collide.
 */
export function scaleLabels(maxKw) {
  if (!isNum(maxKw) || maxKw <= 0) return [];
  const raw = maxKw / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw * 0.8) ?? 10 * mag;
  const values = [];
  for (let v = 0; v < maxKw - step * 0.4; v += step) values.push(Math.round(v * 10) / 10);
  values.push(maxKw);
  return values.map((v) => {
    const share = v / maxKw;
    const text = `${Number.isInteger(v) ? v : fmt1(v)}${v === maxKw ? ' kW' : ''}`;
    return { share, text, ...at(share, LABEL_R) };
  });
}
const fmt1 = (v) => (Math.round(v * 10) / 10).toString();

/** The half disc of the sun (an SVG path). */
export const SUN_PATH = `M ${-SUN_R} 0 A ${SUN_R} ${SUN_R} 0 0 1 ${SUN_R} 0 Z`;
/** The scale arc, horizon to horizon. */
export const SCALE_PATH = `M ${-SCALE_R} 0 A ${SCALE_R} ${SCALE_R} 0 0 1 ${SCALE_R} 0`;
