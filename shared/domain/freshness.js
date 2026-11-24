// shared/domain/freshness.js
//
// Decision logic for "has the v3 telemetry pipeline silently stopped?" (issue #156). Pure, so the
// rules are tested; scripts/check_data_freshness.js feeds it rows and acts on the verdict.
//
// `required` is false until the pipeline has produced its first successful run: before that,
// an empty table is "not started yet", not an outage, and flagging it would open a false
// data-outage issue the moment this check is deployed. Once the nightly job is proven, set
// TELEMETRY_REQUIRED=true so that an EMPTY table also fails — otherwise a collector that was
// never wired up would stay invisible forever.

import { diffDays } from './time.js';

const HOUR_MS = 3_600_000;

/**
 * @param {object} a
 * @param {{status:string, started_at:string}|null} a.latestRun     newest collector_runs row, any status
 * @param {{status:string, started_at:string}|null} a.latestOkRun   newest row with status 'ok'
 * @param {number} a.nowMs
 * @param {number} [a.maxAgeHours]  newest successful run must be younger than this (nightly + slack)
 * @param {boolean} [a.required]
 */
export function evaluateCollectorRuns({ latestRun, latestOkRun, nowMs, maxAgeHours = 36, required = false }) {
  const name = 'collector_runs';
  if (!latestRun) {
    return required
      ? { name, ok: false, reason: 'no collector run has ever been recorded' }
      : { name, ok: true, skipped: true, reason: 'pipeline has not run yet (check not armed)' };
  }
  if (latestRun.status === 'failed' || latestRun.status === 'empty') {
    return { name, ok: false, latest: latestRun.started_at, reason: `the most recent run ended '${latestRun.status}'` };
  }
  if (!latestOkRun) {
    return { name, ok: false, latest: latestRun.started_at, reason: 'no run has ever completed successfully' };
  }
  const ageHours = (nowMs - Date.parse(latestOkRun.started_at)) / HOUR_MS;
  if (ageHours > maxAgeHours) {
    return {
      name, ok: false, latest: latestOkRun.started_at, ageHours: Number(ageHours.toFixed(1)),
      threshold: `${maxAgeHours} hours`,
      reason: `last successful run was ${ageHours.toFixed(1)} hours ago (limit ${maxAgeHours})`
    };
  }
  return { name, ok: true, latest: latestOkRun.started_at, ageHours: Number(ageHours.toFixed(1)), threshold: `${maxAgeHours} hours` };
}

/**
 * @param {object} a
 * @param {string|null} a.latestDay  newest inverter_day_uptime.day ('YYYY-MM-DD'), null if empty
 * @param {string} a.todayKey        today's Colombo date key
 * @param {number} [a.maxAgeDays]
 * @param {boolean} [a.required]
 */
export function evaluateUptimeFreshness({ latestDay, todayKey, maxAgeDays = 2, required = false }) {
  const name = 'inverter_day_uptime';
  if (!latestDay) {
    return required
      ? { name, ok: false, reason: 'table is empty' }
      : { name, ok: true, skipped: true, reason: 'pipeline has not produced a day yet (check not armed)' };
  }
  const ageDays = diffDays(latestDay, todayKey);
  if (ageDays > maxAgeDays) {
    return {
      name, ok: false, latest: latestDay, ageDays, threshold: `${maxAgeDays} days`,
      reason: `newest derived day is ${ageDays} days old (limit ${maxAgeDays})`
    };
  }
  return { name, ok: true, latest: latestDay, ageDays, threshold: `${maxAgeDays} days` };
}

/**
 * Is the live feed (`inverter_data_live`) stale right now? Issue #241's daytime check, run by the
 * watchdog every 15 minutes. Only judged inside the day's operating window (sunrise + 30 min to
 * sunset − 30 min, LR-002 R1): at night the inverter is off and no reading is expected. The clock
 * starts at the later of the newest reading and the window's start, so the first check of the
 * morning does not count the night.
 *
 * @param {object} a
 * @param {string|null} a.latestIso      newest `data_timestamp`
 * @param {number} a.nowMs
 * @param {{startMs:number, endMs:number}|null} a.window   operatingWindow() of today
 * @param {number} [a.maxAgeMinutes]
 * @returns {{ name: string, state: 'ok'|'stale'|'night', ageMinutes: number|null, reason: string }}
 */
export function evaluateLiveFreshness({ latestIso, nowMs, window, maxAgeMinutes = 60 }) {
  const name = 'inverter_data_live';
  const latestMs = latestIso ? Date.parse(latestIso) : NaN;
  const ageMinutes = Number.isFinite(latestMs) ? Math.round((nowMs - latestMs) / 60_000) : null;
  if (!window || nowMs < window.startMs || nowMs > window.endMs) {
    return { name, state: 'night', ageMinutes, reason: 'outside the operating window: no reading expected' };
  }
  const since = Math.max(Number.isFinite(latestMs) ? latestMs : -Infinity, window.startMs);
  const silentMinutes = Math.round((nowMs - since) / 60_000);
  if (silentMinutes > maxAgeMinutes) {
    return {
      name,
      state: 'stale',
      ageMinutes,
      reason: ageMinutes == null
        ? `no live reading at all, ${silentMinutes} minutes into daylight (limit ${maxAgeMinutes})`
        : `newest live reading is ${ageMinutes} minutes old (limit ${maxAgeMinutes} in daylight)`
    };
  }
  return { name, state: 'ok', ageMinutes, reason: ageMinutes == null ? 'daylight has just begun' : `newest live reading is ${ageMinutes} minutes old` };
}

/**
 * Is the watchdog (POST /api/ops/watch, every 15 minutes from Supabase pg_cron) still running? Checked by
 * the daily Data Freshness Check on GitHub, from the newest successful `ops/watch` row in request_log, so
 * the thing that sends alerts cannot stop silently. Not armed until WATCHDOG_REQUIRED=true, after the
 * schedule is set up (issue #241).
 *
 * @param {{ latestIso: string|null, nowMs: number, maxAgeHours?: number, required?: boolean }} a
 */
export function evaluateWatchdog({ latestIso, nowMs, maxAgeHours = 2, required = false }) {
  const name = 'ops_watch';
  if (!required) return { name, ok: true, skipped: true, reason: 'watchdog check not armed (WATCHDOG_REQUIRED is not true)' };
  if (!latestIso) return { name, ok: false, reason: 'the watchdog has never completed a run (no ops/watch 200 in request_log)' };
  const ageHours = (nowMs - Date.parse(latestIso)) / HOUR_MS;
  return ageHours <= maxAgeHours
    ? { name, ok: true, latest: latestIso, ageHours: Number(ageHours.toFixed(1)), reason: null }
    : { name, ok: false, latest: latestIso, ageHours: Number(ageHours.toFixed(1)), reason: `the watchdog last completed ${ageHours.toFixed(1)} hours ago (limit ${maxAgeHours}): check cron.job_run_details in Supabase and OPS_WATCH_SECRET` };
}
