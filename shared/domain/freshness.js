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
