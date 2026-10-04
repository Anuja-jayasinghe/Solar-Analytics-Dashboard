// api/_lib/data/live.js
//
// "Right now" status, fetched server-side from SolisCloud (replaces the browser calling the
// `solis-live-data` Edge Function with the public anon key).
//
// Cached in memory for a short TTL so many open dashboards cost one upstream call per minute.
// If SolisCloud fails we serve the last good value marked `stale: true` rather than inventing
// zeros; with nothing cached the caller gets a 502, never a fabricated reading.
//
// State mapping (Solis docs): 1 online, 2 offline, 3 alarm. NOTE state 2 is NORMAL every night,
// so `abnormalOffline` (stateExceptionFlag === 1) is what signals a real problem.

import { HttpError } from '../../../shared/data/query.js';
import { energyToKwh, powerToKw, toNum } from '../../../shared/domain/solisNormalize.js';
import { peakOfDay } from '../../../shared/domain/dayPeak.js';
import { localDateKey } from '../../../shared/domain/time.js';

const STATUS = { 1: 'online', 2: 'offline', 3: 'alarm' };

export function mapLive(rec, fetchedAtMs, peak = null) {
  const totalKwh = toNum(rec.etotal1) ?? energyToKwh(rec.etotal, rec.etotalStr);
  return {
    status: STATUS[toNum(rec.state)] ?? 'unknown',
    abnormalOffline: toNum(rec.stateExceptionFlag) === 1,
    faultCode: toNum(rec.state) === 3 || toNum(rec.alarmLevel) > 0 ? (rec.currentState ?? null) : null,
    currentPowerKw: powerToKw(rec.pac, rec.pacPec, rec.pacStr),
    todayKwh: energyToKwh(rec.etoday, rec.etodayStr),
    totalKwh,
    // Highest power so far today and when (Colombo time); null when the day's readings are unavailable.
    peakTodayKw: peak ? peak.kw : null,
    peakTodayAt: peak ? peak.at : null,
    dataTimestamp: toNum(rec.dataTimestamp),
    fetchedAt: fetchedAtMs,
    stale: false
  };
}

/**
 * @param {object} a
 * @param {() => Promise<object|null>} a.fetchInverter  returns the inverterList record
 * @param {(dateKey:string) => Promise<unknown[]>} [a.fetchDay]  today's raw inverterDay points, for the peak. Optional:
 *   without it, or if it fails, the peak is simply unknown and everything else still works.
 * @param {number} [a.ttlMs]
 * @param {number} [a.peakTtlMs]  how long a computed peak is reused (default 5 min: it is a whole day of points)
 * @param {() => number} [a.now]
 */
export function createLiveProvider({ fetchInverter, fetchDay = null, ttlMs = 60_000, peakTtlMs = 300_000, now = () => Date.now() }) {
  let cached = null;
  let peakCache = null; // { dateKey, at, peak }
  let inFlight = null;

  /** Today's peak, cached, never throwing: a failure keeps the last peak for the same day or reports unknown. */
  async function todayPeak() {
    if (!fetchDay) return null;
    const dateKey = localDateKey(now());
    if (peakCache && peakCache.dateKey === dateKey && now() - peakCache.at < peakTtlMs) return peakCache.peak;
    try {
      const peak = peakOfDay(await fetchDay(dateKey));
      peakCache = { dateKey, at: now(), peak };
      return peak;
    } catch (err) {
      console.error('live: peak unavailable', err?.message);
      return peakCache && peakCache.dateKey === dateKey ? peakCache.peak : null;
    }
  }

  return async function live() {
    const t = now();
    if (cached && t - cached.fetchedAt < ttlMs) return cached;
    if (inFlight) return inFlight; // collapse concurrent callers into one upstream request

    inFlight = (async () => {
      try {
        const [rec, peak] = await Promise.all([fetchInverter(), todayPeak()]);
        if (!rec) throw new Error('no inverter returned');
        cached = mapLive(rec, now(), peak);
        return cached;
      } catch (err) {
        console.error('live: upstream failure', err?.message);
        if (cached) return { ...cached, stale: true };
        throw new HttpError(502, 'Live data is temporarily unavailable', 'upstream_unavailable');
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
