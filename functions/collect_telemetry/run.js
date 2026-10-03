// functions/collect_telemetry/run.js
//
// Core of the telemetry collector (issue #156). Pure orchestration with INJECTED adapters, so the
// behaviour that matters — dry run writes nothing, a failed day never produces a fake row, an
// empty result is a failure, peak back-fill never overwrites — is covered by tests without a
// network or a database. The CLI wiring (real Solis + Supabase) lives in index.js.
//
// For each local day: fetch inverterDay + collector/day, build rows (shared/domain), derive
// uptime (LR-002), write idempotently. Alarms are fetched once for the whole range (paginated).
//
// Adapter contracts:
//   solis.listInverters()                      -> { sn, collectorSn, stationId }
//   solis.inverterDay(sn, dateKey)             -> raw point[]
//   solis.collectorDay(collectorSn, dateKey)   -> raw point[]
//   solis.alarms(sn, stationId, fromKey, toKey)-> raw alarm[] (ALL pages)
//   db.startRun(info) -> id | null ;  db.finishRun(id, patch)
//   db.upsert(table, rows, onConflict)
//   db.replaceSegments(sn, dateKey, rows)
//   db.getSummary(fromKey, toKey)              -> [{ summary_date, total_generation_kwh, peak_power_kw }]
//   db.setPeakIfNull(dateKey, peakKw)          -> boolean (true if a row was changed)

import { addDays } from '../../shared/domain/time.js';
import { buildDayRecords, prepareAlarms, toAlarmRow } from '../../shared/domain/telemetryPipeline.js';

const CHUNK = 500;
const RECONCILE_TOLERANCE_KWH = 1.5;

async function writeChunked(db, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.upsert(table, rows.slice(i, i + CHUNK), onConflict);
  }
  return rows.length;
}

/**
 * @param {object} a
 * @param {string[]} a.dates       local date keys to process, ascending
 * @param {boolean} a.write        false = dry run: nothing is written anywhere
 * @param {boolean} [a.fillPeaks]  also set peak_power_kw on summary rows where it is NULL
 */
export async function runCollector({ solis, db, dates, write, fillPeaks = false, now = Date.now(), log = () => {}, job = 'collect_telemetry' }) {
  const report = {
    status: 'ok', write, job, dates: dates.length, days: [], alarmsFetched: null, alarmsWritten: 0,
    pointsWritten: 0, daysDerived: 0, failedDays: 0, collectorFailures: 0,
    peaksFilled: 0, peaksWouldFill: 0, reconcile: [], missingSummary: [], error: null
  };
  if (dates.length === 0) {
    report.status = 'failed';
    report.error = 'no dates to process';
    return report;
  }

  let inv;
  try {
    inv = await solis.listInverters();
    if (!inv?.sn) throw new Error('SolisCloud returned no inverter');
  } catch (e) {
    report.status = 'failed';
    report.error = `inverter lookup failed: ${e.message}`;
    return report;
  }

  const runId = write ? await db.startRun({ job, date_from: dates[0], date_to: dates[dates.length - 1] }) : null;

  // Alarms: once for the whole range. null = the fetch failed (unknown), never "none".
  let alarms = null;
  try {
    const raw = await solis.alarms(inv.sn, inv.stationId, addDays(dates[0], -1), addDays(dates[dates.length - 1], 1));
    alarms = prepareAlarms(raw);
    report.alarmsFetched = alarms.length;
    log(`alarms: ${alarms.length}`);
  } catch (e) {
    report.error = `alarm fetch failed: ${e.message}`;
    log(`WARN ${report.error} — uptime will be derived with alarms unknown`);
  }

  const summaryRows = new Map();
  try {
    for (const r of await db.getSummary(dates[0], dates[dates.length - 1])) summaryRows.set(String(r.summary_date).slice(0, 10), r);
  } catch (e) {
    log(`WARN could not read daily summary for reconciliation: ${e.message}`);
  }

  for (const dateKey of dates) {
    const day = { dateKey, status: null, points: 0, uptimePct: null, trips: 0, gaps: 0, error: null };
    try {
      const rawPoints = await solis.inverterDay(inv.sn, dateKey);
      let rawCollector = null;
      if (inv.collectorSn) {
        try {
          rawCollector = await solis.collectorDay(inv.collectorSn, dateKey);
        } catch (e) {
          report.collectorFailures++;
          log(`WARN ${dateKey}: collector/day failed (${e.message}); logger evidence unknown`);
        }
      }

      const rec = buildDayRecords({ sn: inv.sn, collectorSn: inv.collectorSn, dateKey, rawPoints, rawCollector, alarms, now });
      day.status = rec.derived.status;
      day.points = rec.telemetryRows.length;
      day.uptimePct = rec.derived.uptimePct;
      day.trips = rec.derived.tripCount;
      day.gaps = rec.derived.gapCount;

      if (write) {
        report.pointsWritten += await writeChunked(db, 'inverter_telemetry', rec.telemetryRows, 'inverter_sn,ts');
        await writeChunked(db, 'collector_heartbeats', rec.heartbeatRows, 'collector_sn,ts');
        await db.upsert('inverter_day_uptime', [rec.uptimeRow], 'inverter_sn,day');
        await db.replaceSegments(inv.sn, dateKey, rec.segmentRows);
      }
      report.daysDerived++;

      // Reconciliation against the existing daily summary (report only, never written).
      const summary = summaryRows.get(dateKey);
      if (rec.maxETodayKwh !== null) {
        if (!summary) report.missingSummary.push({ dateKey, solisKwh: rec.maxETodayKwh });
        else if (Math.abs(Number(summary.total_generation_kwh) - rec.maxETodayKwh) > RECONCILE_TOLERANCE_KWH) {
          report.reconcile.push({ dateKey, summaryKwh: Number(summary.total_generation_kwh), solisKwh: rec.maxETodayKwh });
        }
      }

      // Peak back-fill: only where the summary row EXISTS and its peak is NULL. Never overwrites.
      if (fillPeaks && rec.peakKw !== null && summary && summary.peak_power_kw === null) {
        if (write) {
          if (await db.setPeakIfNull(dateKey, rec.peakKw)) report.peaksFilled++;
        } else {
          report.peaksWouldFill++;
        }
      }
    } catch (e) {
      day.status = 'failed';
      day.error = e.message;
      report.failedDays++;
      log(`ERROR ${dateKey}: ${e.message}`);
    }
    report.days.push(day);
  }

  if (write && alarms) {
    try {
      report.alarmsWritten = await writeChunked(db, 'inverter_alarms', alarms.map((a) => toAlarmRow(inv.sn, a)), 'inverter_sn,alarm_code,begin_ts');
    } catch (e) {
      report.error = `alarm write failed: ${e.message}`;
    }
  }

  const totalPoints = report.days.reduce((s, d) => s + d.points, 0);
  if (report.failedDays > 0 || alarms === null || (report.error && report.error.includes('write failed'))) report.status = 'failed';
  else if (totalPoints === 0) report.status = 'empty'; // nothing processed is not success
  if (report.status !== 'ok' && !report.error) report.error = report.status === 'empty' ? 'no telemetry points for any requested day' : `${report.failedDays} day(s) failed`;

  if (runId !== null && runId !== undefined) {
    await db.finishRun(runId, {
      status: report.status,
      points_written: report.pointsWritten,
      alarms_written: report.alarmsWritten,
      days_derived: report.daysDerived,
      error: report.error
    });
  }
  return report;
}
