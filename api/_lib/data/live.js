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

import { HttpError } from './query.js';
import { energyToKwh, powerToKw, toNum } from '../../../shared/domain/solisNormalize.js';

const STATUS = { 1: 'online', 2: 'offline', 3: 'alarm' };

export function mapLive(rec, fetchedAtMs) {
  const totalKwh = toNum(rec.etotal1) ?? energyToKwh(rec.etotal, rec.etotalStr);
  return {
    status: STATUS[toNum(rec.state)] ?? 'unknown',
    abnormalOffline: toNum(rec.stateExceptionFlag) === 1,
    faultCode: toNum(rec.state) === 3 || toNum(rec.alarmLevel) > 0 ? (rec.currentState ?? null) : null,
    currentPowerKw: powerToKw(rec.pac, rec.pacPec, rec.pacStr),
    todayKwh: energyToKwh(rec.etoday, rec.etodayStr),
    totalKwh,
    dataTimestamp: toNum(rec.dataTimestamp),
    fetchedAt: fetchedAtMs,
    stale: false
  };
}

/**
 * @param {object} a
 * @param {() => Promise<object|null>} a.fetchInverter  returns the inverterList record
 * @param {number} [a.ttlMs]
 * @param {() => number} [a.now]
 */
export function createLiveProvider({ fetchInverter, ttlMs = 60_000, now = () => Date.now() }) {
  let cached = null;
  let inFlight = null;

  return async function live() {
    const t = now();
    if (cached && t - cached.fetchedAt < ttlMs) return cached;
    if (inFlight) return inFlight; // collapse concurrent callers into one upstream request

    inFlight = (async () => {
      try {
        const rec = await fetchInverter();
        if (!rec) throw new Error('no inverter returned');
        cached = mapLive(rec, now());
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
