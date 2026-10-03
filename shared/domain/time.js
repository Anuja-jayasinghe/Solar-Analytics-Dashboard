// shared/domain/time.js
//
// Time helpers for the site (Asia/Colombo, UTC+5:30, no daylight saving).
//
// This module is pure: no Date.now(), no env, no DOM, no dependencies, so it runs unchanged in the
// browser, in Vercel functions and in GitHub Actions scripts.
//
// Calendar days are always 'YYYY-MM-DD' strings ("date keys"). Instants are epoch milliseconds.
// Never use `.toISOString()` on a local-midnight Date to build a date key (it shifts the date back
// a day east of UTC); everything here goes through epoch arithmetic instead.

export const SITE = Object.freeze({ lat: 7.0713, lon: 80.0088 });
export const COLOMBO_OFFSET_MIN = 330;
const OFFSET_MS = COLOMBO_OFFSET_MIN * 60_000;
const DAY_MS = 86_400_000;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function assertDateKey(value) {
  if (!isDateKey(value)) throw new RangeError(`Invalid date key: ${String(value)}`);
}

/** The Asia/Colombo calendar day containing the instant `epochMs`. */
export function localDateKey(epochMs) {
  return new Date(epochMs + OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since local midnight (0–1439.999…) for the instant `epochMs`. */
export function localMinuteOfDay(epochMs) {
  const local = epochMs + OFFSET_MS;
  return (((local % DAY_MS) + DAY_MS) % DAY_MS) / 60_000;
}

/** Epoch ms of local midnight at the start of `dateKey`. */
export function startOfLocalDayMs(dateKey) {
  assertDateKey(dateKey);
  return Date.parse(`${dateKey}T00:00:00Z`) - OFFSET_MS;
}

/** `dateKey` shifted by `n` calendar days (n may be negative). */
export function addDays(dateKey, n) {
  assertDateKey(dateKey);
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a, b) {
  assertDateKey(a);
  assertDateKey(b);
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Every date key from `from` to `to`, inclusive. Empty if `to` is before `from`. */
export function eachDateKey(from, to) {
  const n = diffDays(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

/**
 * Same calendar day one year earlier. 29 Feb maps to 28 Feb (documented, deterministic).
 */
export function sameDayLastYear(dateKey) {
  assertDateKey(dateKey);
  const y = Number(dateKey.slice(0, 4)) - 1;
  const md = dateKey.slice(5);
  const key = md === '02-29' ? `${y}-02-28` : `${y}-${md}`;
  return key;
}

// ---------------------------------------------------------------------------------------------
// Sunrise / sunset (NOAA "sunrise equation"). Accurate to a couple of minutes, which is far finer
// than anything the operating-window rule (LR-002 R1) needs.
// ---------------------------------------------------------------------------------------------

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * Sunrise and sunset, as epoch ms, for the Colombo calendar day `dateKey`.
 * Returns `null` for either value on days without one (not reachable at this latitude, but the
 * function is honest about it rather than returning NaN).
 */
export function sunTimes(dateKey, { lat, lon } = SITE) {
  assertDateKey(dateKey);
  const noonUtcMs = Date.parse(`${dateKey}T12:00:00Z`);
  const jd = noonUtcMs / DAY_MS + 2440587.5;
  const n = Math.round(jd - 2451545.0);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda));
  const sinDelta = Math.sin(rad(lambda)) * Math.sin(rad(23.4397));
  const cosDelta = Math.cos(Math.asin(sinDelta));
  const cosOmega = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * sinDelta) / (Math.cos(rad(lat)) * cosDelta);
  if (cosOmega < -1 || cosOmega > 1) return { sunriseMs: null, sunsetMs: null };
  const omega = deg(Math.acos(cosOmega));
  const toMs = (j) => Math.round((j - 2440587.5) * DAY_MS);
  return { sunriseMs: toMs(jTransit - omega / 360), sunsetMs: toMs(jTransit + omega / 360) };
}

export const WINDOW_MARGIN_MIN = 30;

/**
 * The operating window for a local day (LR-002 R1): [sunrise + margin, sunset − margin].
 * `null` when the sun does not rise/set that day.
 */
export function operatingWindow(dateKey, { site = SITE, marginMin = WINDOW_MARGIN_MIN } = {}) {
  const { sunriseMs, sunsetMs } = sunTimes(dateKey, site);
  if (sunriseMs == null || sunsetMs == null) return null;
  const startMs = sunriseMs + marginMin * 60_000;
  const endMs = sunsetMs - marginMin * 60_000;
  if (endMs <= startMs) return null;
  return { startMs, endMs, minutes: (endMs - startMs) / 60_000 };
}
