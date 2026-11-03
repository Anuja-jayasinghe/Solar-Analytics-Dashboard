// api/_lib/data/live.js
//
// "Right now" status, fetched server-side from SolisCloud (replaces the browser calling the
// `solis-live-data` Edge Function with the public anon key; that function was deleted 2026-10-29).
//
// Cached in memory for a short TTL so many open dashboards cost one upstream call per minute.
// If SolisCloud fails we never invent a reading. We serve the newest REAL one we have, marked
// `stale: true, upstream: 'unavailable'`: the last good value in memory, or the newest reading the
// scheduled job saved in `inverter_data_live` today (`source: 'saved'`; a fresh deployment has
// nothing in memory). With neither, the caller gets a 502 `upstream_unavailable`.
//
// `source` says where the reading came from: 'soliscloud' (just now), 'memory', or 'saved'.
//
// State mapping (Solis docs): 1 online, 2 offline, 3 alarm. NOTE state 2 is NORMAL every night,
// so `abnormalOffline` (stateExceptionFlag === 1) is what signals a real problem.

import { HttpError } from '../../../shared/data/query.js';
import { energyToKwh, powerToKw, toNum } from '../../../shared/domain/solisNormalize.js';
import { peakOfDay } from '../../../shared/domain/dayPeak.js';
import { normalizeDayPoints } from '../../../shared/domain/solisNormalize.js';
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
    stale: false,
    upstream: 'ok',
    source: 'soliscloud'
  };
}

/**
 * @param {object} a
 * @param {() => Promise<object|null>} a.fetchInverter  returns the inverterList record
 * @param {(dateKey:string) => Promise<unknown[]>} [a.fetchDay]  today's raw inverterDay points, for the peak. Optional:
 *   without it, or if it fails, the peak is simply unknown and everything else still works.
 * @param {number} [a.ttlMs]
 * @param {number} [a.peakWaitMs]  the live reading never waits longer than this for the peak: the right-now numbers matter
 *   more than the day's maximum, so a slow day-read is reported as unknown this time and used on the next call
 * @param {number} [a.peakTtlMs]  how long a computed peak is reused (default 5 min: it is a whole day of points)
 * @param {() => Promise<{raw: object, savedAtMs: number}|null>} [a.fetchSaved]  the newest reading the scheduled job saved
 *   (the same SolisCloud record shape), used only when SolisCloud fails; one from an earlier day is ignored
 * @param {() => number} [a.now]
 */
export function createLiveProvider({ fetchInverter, fetchDay = null, fetchSaved = null, ttlMs = 60_000, peakTtlMs = 300_000, peakWaitMs = 2_500, now = () => Date.now() }) {
  let cached = null;
  let peakCache = null; // { dateKey, at, peak, points }: today's inverterDay, read at most every peakTtlMs
  let peakInFlight = null;
  let inFlight = null;

  /**
   * Today's 5-minute points and peak, cached, never throwing: a failure keeps the last read for the same day or
   * reports unknown. The same read feeds the live peak and the "through the day" power curve.
   */
  async function refreshPeak(dateKey) {
    try {
      const raw = await fetchDay(dateKey);
      const peak = peakOfDay(raw);
      const points = normalizeDayPoints(raw).points
        .filter((p) => typeof p.pacKw === 'number' && Number.isFinite(p.pacKw) && p.pacKw >= 0)
        .map((p) => ({ ts: new Date(p.ts).toISOString(), pac_kw: p.pacKw }));
      peakCache = { dateKey, at: now(), peak, points };
      return peak;
    } catch (err) {
      console.error('live: peak unavailable', err?.message);
      return peakCache && peakCache.dateKey === dateKey ? peakCache.peak : null;
    }
  }

  async function todayPeak() {
    if (!fetchDay) return null;
    const dateKey = localDateKey(now());
    if (peakCache && peakCache.dateKey === dateKey && now() - peakCache.at < peakTtlMs) return peakCache.peak;
    // The day-read keeps running if it is slow; its result is cached for the next call.
    peakInFlight = peakInFlight ?? refreshPeak(dateKey).finally(() => { peakInFlight = null; });
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), peakWaitMs); });
    const peak = await Promise.race([peakInFlight, timeout]);
    clearTimeout(timer);
    if (peak !== undefined) return peak;
    return peakCache && peakCache.dateKey === dateKey ? peakCache.peak : null;
  }

  /** Today's newest saved reading, mapped like a live one, or null. Never throws. */
  async function savedReading() {
    if (!fetchSaved) return null;
    try {
      const saved = await fetchSaved();
      if (!saved || !saved.raw || !Number.isFinite(saved.savedAtMs)) return null;
      const todayKey = localDateKey(now());
      // An earlier day's reading would show yesterday's "today" total as today's.
      if (localDateKey(saved.savedAtMs) !== todayKey) return null;
      const peak = peakCache && peakCache.dateKey === todayKey ? peakCache.peak : null;
      const reading = mapLive(saved.raw, now(), peak);
      return { ...reading, dataTimestamp: reading.dataTimestamp ?? saved.savedAtMs, source: 'saved' };
    } catch (err) {
      console.error('live: saved reading unavailable', err?.message);
      return null;
    }
  }

  const readingTime = (r) => r.dataTimestamp ?? r.fetchedAt ?? 0;

  async function live() {
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
        const saved = await savedReading();
        const memory = cached ? { ...cached, source: 'memory' } : null;
        const newest = [memory, saved].filter(Boolean).sort((a, b) => readingTime(b) - readingTime(a))[0];
        if (newest) return { ...newest, stale: true, upstream: 'unavailable' };
        throw new HttpError(502, 'Live data is temporarily unavailable', 'upstream_unavailable');
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  /**
   * Today's 5-minute power points from SolisCloud ({ ts, pac_kw }, the same shape as stored telemetry), read at
   * most every peakTtlMs. Null when there is no day reader or nothing has been read for today yet.
   * @returns {Promise<{date:string, points:{ts:string,pac_kw:number}[], fetchedAt:number}|null>}
   */
  live.today = async function today() {
    if (!fetchDay) return null;
    const dateKey = localDateKey(now());
    const fresh = peakCache && peakCache.dateKey === dateKey && now() - peakCache.at < peakTtlMs;
    if (!fresh) {
      peakInFlight = peakInFlight ?? refreshPeak(dateKey).finally(() => { peakInFlight = null; });
      await peakInFlight;
    }
    return peakCache && peakCache.dateKey === dateKey && peakCache.points
      ? { date: dateKey, points: peakCache.points, fetchedAt: peakCache.at }
      : null;
  };

  return live;
}
