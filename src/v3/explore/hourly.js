// src/v3/explore/hourly.js
//
// One day, hour by hour. The API gives ~5-minute telemetry points ({ ts, pac_kw }); this integrates power
// over time into kWh per local (Asia/Colombo) hour. A day with no points is "no data", never a flat zero.

export const FIRST_HOUR = 5;
export const LAST_HOUR = 19;
const COLOMBO_OFFSET_MS = 330 * 60000;
const MAX_STEP_MIN = 10; // a longer gap is a data hole, not ten more minutes of the same output

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Local hour (0..23) and 'HH:MM' for an ISO timestamp, in Asia/Colombo. */
export function colomboClock(ts) {
  const d = new Date(Date.parse(ts) + COLOMBO_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return { hour: h, hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

/**
 * @param {{ts:string, pac_kw:number|null}[]} points  one day, ascending
 * @returns {null | { hours:{hour:number,kwh:number}[], totalKwh:number, peak:{kw:number,at:string}|null }}
 *   null when there are no usable points
 */
export function hourlyFromTelemetry(points) {
  const usable = (points ?? []).filter((p) => p && typeof p.ts === 'string' && !Number.isNaN(Date.parse(p.ts)));
  if (usable.length === 0) return null;

  const hours = [];
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) hours.push({ hour: h, kwh: 0 });
  let peak = null;
  let any = false;

  for (let i = 0; i < usable.length; i++) {
    const p = usable[i];
    if (!isNum(p.pac_kw)) continue;
    any = true;
    const next = usable[i + 1];
    const stepMin = next ? Math.min(MAX_STEP_MIN, (Date.parse(next.ts) - Date.parse(p.ts)) / 60000) : 5;
    const { hour, hhmm } = colomboClock(p.ts);
    if (hour >= FIRST_HOUR && hour <= LAST_HOUR && stepMin > 0) hours[hour - FIRST_HOUR].kwh += (p.pac_kw * stepMin) / 60;
    if (!peak || p.pac_kw > peak.kw) peak = { kw: p.pac_kw, at: hhmm };
  }
  if (!any) return null;
  const rounded = hours.map((h) => ({ hour: h.hour, kwh: Math.round(h.kwh * 10) / 10 }));
  return { hours: rounded, totalKwh: rounded.reduce((s, h) => s + h.kwh, 0), peak: peak ? { kw: Math.round(peak.kw * 10) / 10, at: peak.at } : null };
}
