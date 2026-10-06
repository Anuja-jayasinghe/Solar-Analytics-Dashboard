// api/_lib/data/resources.js
//
// The read API's resources. Each is a pure function of (repo, params, ctx) → { body } or
// { csv, filename }, so it is tested with a fake repository and no network. All numerical
// logic comes from shared/domain, the same modules the collector and the browser use.
//
// Conventions: unknown is null (never 0); every figure that depends on a choice (which tariff,
// how complete the data is) carries that choice in the response.

import { aggregateUptime } from '../domain/uptime.js';
import { summarizeElectricalRange } from '../domain/electricalRange.js';
import { uptimeRowToDay } from '../domain/telemetryPipeline.js';
import { addDays, diffDays } from '../domain/time.js';
import { buildAlignedRows } from '../domain/alignment.js';
import {
  buildBillRatePeriods, compareRanges, computeRangeStats, previousPeriod, sameRangeLastYear
} from '../domain/rangeStats.js';
import { HttpError, parseCompare, parseDate, parseEnum, parseIntBounded, parseRange, parseYear } from './query.js';
import { toCsv } from './csv.js';

const MAX_SEGMENT_DAYS = 62;
const MAX_TOTALS_DAYS = 3660;

function rateFor(mode, settings, bills) {
  if (mode === 'fixed') return { mode: 'fixed', ratePerKwh: settings.ratePerKwh };
  return { mode: 'effective', periods: buildBillRatePeriods(bills), fallbackRatePerKwh: null };
}

async function statsFor(repo, settings, rate, from, to) {
  const rows = await repo.dailyRows(from, to);
  return computeRangeStats({ from, to, rows, capacityKwp: settings.capacityKwp, acRatedKw: settings.acRatedKw, rate });
}

const slim = (stats) => ({ ...stats, series: undefined });

export const resources = {
  /** Explore: every output for a user-chosen range (inverter only; decision D-5). */
  async range(repo, query) {
    const { from, to } = parseRange(query);
    const rateMode = parseEnum(query, 'rate', ['effective', 'fixed'], 'effective');
    const compare = parseCompare(query);

    const [settings, bills, uptimeRows] = await Promise.all([repo.settings(), repo.bills(), repo.uptimeDays(from, to)]);
    const rate = rateFor(rateMode, settings, bills);
    const stats = await statsFor(repo, settings, rate, from, to);

    const comparisons = {};
    for (const kind of compare) {
      const win = kind === 'prev' ? previousPeriod(from, to) : sameRangeLastYear(from, to);
      const base = await statsFor(repo, settings, rate, win.from, win.to);
      comparisons[kind] = { range: win, stats: slim(base), delta: compareRanges(stats, base) };
    }

    return {
      body: {
        from, to, rateMode,
        settings: { capacityKwp: settings.capacityKwp, acRatedKw: settings.acRatedKw, ratePerKwh: settings.ratePerKwh },
        stats,
        comparisons,
        uptime: { daysTracked: uptimeRows.length, ...aggregateUptime(uptimeRows.map(uptimeRowToDay)) }
      }
    };
  },

  /** CEB vs inverter, 12 bill-aligned rows for a year (LR-001). */
  async comparison(repo, query, ctx) {
    const year = parseYear(query);
    const [dailyRows, bills] = await Promise.all([
      repo.dailyRows(`${year - 1}-12-01`, `${year + 1}-01-31`),
      repo.bills()
    ]);
    return { body: { year, rows: buildAlignedRows({ year, dailyRows, bills, todayKey: ctx.todayKey }) } };
  },

  /** Every bill with its period, effective rate and the inverter total for that period. */
  async bills(repo, _query, ctx) {
    const bills = await repo.bills();
    if (bills.length === 0) return { body: { bills: [] } };
    const years = [...new Set(bills.map((b) => Number(b.bill_date.slice(0, 4))))];
    const minYear = Math.min(...years) - 1;
    const maxYear = Math.max(...years);
    const dailyRows = await repo.dailyRows(`${minYear}-01-01`, `${maxYear}-12-31`);

    const aligned = new Map();
    for (let y = minYear; y <= maxYear; y++) {
      for (const r of buildAlignedRows({ year: y, dailyRows, bills, todayKey: ctx.todayKey })) {
        if (r.status === 'finalized') aligned.set(r.billDate, r);
      }
    }
    const rates = new Map(buildBillRatePeriods(bills).map((p) => [p.endDate, p.ratePerKwh]));

    const out = bills.map((b) => {
      const a = aligned.get(b.bill_date);
      const cebKwh = b.units_exported === null || b.units_exported === undefined ? null : Number(b.units_exported);
      const inverterKwh = a?.inverter ?? null;
      const variance = cebKwh !== null && inverterKwh !== null ? cebKwh - inverterKwh : null;
      return {
        billDate: b.bill_date,
        periodStart: a?.periodStart ?? null,
        periodEnd: a?.periodEnd ?? b.bill_date,
        cebKwh,
        earningsLkr: b.earnings === null || b.earnings === undefined ? null : Number(b.earnings),
        effectiveRatePerKwh: rates.get(b.bill_date) ?? null,
        inverterKwh,
        daysPresent: a?.daysPresent ?? 0,
        daysInPeriod: a?.daysInPeriod ?? 0,
        // A variance is only trustworthy when every day of the period has data.
        complete: !!a && a.daysPresent === a.daysInPeriod && a.daysInPeriod > 0,
        varianceKwh: variance,
        variancePct: variance !== null && inverterKwh > 0 ? (variance / inverterKwh) * 100 : null
      };
    });
    return { body: { bills: out.sort((x, y) => (x.billDate < y.billDate ? 1 : -1)) } };
  },

  /** Per-day uptime for a range, plus the timeline segments for short ranges. */
  async uptime(repo, query) {
    const { from, to, days } = parseRange(query);
    const rows = await repo.uptimeDays(from, to);
    const body = { from, to, days: rows, aggregate: aggregateUptime(rows.map(uptimeRowToDay)), segments: null };
    if (days <= MAX_SEGMENT_DAYS) body.segments = await repo.segments(from, to);
    return { body };
  },

  async alarms(repo, query) {
    const { from, to } = parseRange(query, { maxDays: 400 });
    const limit = parseIntBounded(query, 'limit', { min: 1, max: 500, fallback: 200 });
    const rows = await repo.alarms(from, to, limit);
    const byCode = {};
    for (const a of rows) byCode[a.alarm_code] = (byCode[a.alarm_code] ?? 0) + 1;
    return { body: { from, to, count: rows.length, truncated: rows.length >= limit, byCode, alarms: rows } };
  },

  /** One day of 5-minute telemetry for the day chart. */
  async telemetry(repo, query) {
    const date = parseDate(query, 'date');
    return { body: { date, points: await repo.telemetryDay(date) } };
  },

  /** Up to 31 completed local days of electrical telemetry, summarized before leaving the server. */
  async electrical(repo, query, ctx) {
    const { from, to } = parseRange(query, { maxDays: 31 });
    if (to >= ctx.todayKey) throw new HttpError(400, 'electrical range must contain completed days only', 'invalid_range');
    return { body: summarizeElectricalRange(await repo.telemetryRange(from, to), from, to) };
  },

  async settings(repo) {
    const s = await repo.settings();
    return { body: { settings: s } };
  },

  /**
   * Right-now status. `todayKey` is the SERVER's Asia/Colombo date: the browser never decides which
   * day "today" is (its clock and timezone may differ, and the demo has its own fixed date).
   */
  async live(repo, _query, ctx) {
    const live = await ctx.live();
    return { body: { ...live, todayKey: ctx.todayKey } };
  },

  /**
   * Lifetime totals for the Overview headline tiles, without shipping every day to the browser.
   * Generation counts only days that HAVE a reading (unknown is never 0) and reports how many days
   * in between are missing. Earnings are the sum of bills that carry an earnings figure; bills
   * without one are counted, not treated as 0.
   */
  async totals(repo, _query, ctx) {
    const from = addDays(ctx.todayKey, -(MAX_TOTALS_DAYS - 1));
    const [rows, bills] = await Promise.all([repo.dailyRows(from, ctx.todayKey), repo.bills()]);

    let totalKwh = 0;
    let dayCount = 0;
    let firstDay = null;
    let lastDay = null;
    for (const r of rows) {
      if (!r || typeof r.kwh !== 'number' || !Number.isFinite(r.kwh) || r.kwh < 0) continue;
      totalKwh += r.kwh;
      dayCount += 1;
      if (firstDay === null || r.date < firstDay) firstDay = r.date;
      if (lastDay === null || r.date > lastDay) lastDay = r.date;
    }

    let earningsLkr = 0;
    let billCount = 0;
    let billsWithoutEarnings = 0;
    let firstBillDate = null;
    let lastBillDate = null;
    for (const b of bills) {
      const e = b.earnings === null || b.earnings === undefined ? NaN : Number(b.earnings);
      if (Number.isFinite(e)) { earningsLkr += e; billCount += 1; } else billsWithoutEarnings += 1;
      if (b.bill_date) {
        if (firstBillDate === null || b.bill_date < firstBillDate) firstBillDate = b.bill_date;
        if (lastBillDate === null || b.bill_date > lastBillDate) lastBillDate = b.bill_date;
      }
    }

    return {
      body: {
        generation: {
          totalKwh: dayCount ? totalKwh : null,
          dayCount,
          firstDay,
          lastDay,
          missingDays: firstDay ? diffDays(firstDay, lastDay) + 1 - dayCount : 0
        },
        earnings: { totalLkr: billCount ? earningsLkr : null, billCount, billsWithoutEarnings, firstBillDate, lastBillDate }
      }
    };
  },

  /** CSV download of a range. Unknown cells are empty, never 0. */
  async export(repo, query) {
    const kind = parseEnum(query, 'kind', ['daily', 'uptime', 'alarms']);
    const { from, to } = parseRange(query, { maxDays: 3660 });
    const stamp = `${from}_${to}`;

    if (kind === 'daily') {
      const rows = await repo.dailyRows(from, to);
      return {
        filename: `daily_generation_${stamp}.csv`,
        csv: toCsv(
          [{ header: 'date', key: 'date' }, { header: 'generation_kwh', key: 'kwh' }, { header: 'peak_kw', key: 'peakKw' }],
          rows
        )
      };
    }
    if (kind === 'uptime') {
      const rows = await repo.uptimeDays(from, to);
      return {
        filename: `uptime_${stamp}.csv`,
        csv: toCsv(
          ['day', 'status', 'uptime_pct', 'window_minutes', 'trip_min', 'gap_min', 'comms_lost_min', 'edge_gap_min', 'trip_count', 'gap_count', 'cadence_min', 'resolution_min']
            .map((k) => ({ header: k, key: k })),
          rows
        )
      };
    }
    const rows = await repo.alarms(from, to, 5000);
    return {
      filename: `alarms_${stamp}.csv`,
      csv: toCsv(
        [
          { header: 'begin', key: 'begin_ts' }, { header: 'end', key: 'end_ts' }, { header: 'code', key: 'alarm_code' },
          { header: 'duration_min', value: (r) => (r.duration_ms === null || r.duration_ms === undefined ? null : Math.round(Number(r.duration_ms) / 600) / 100) },
          { header: 'level', key: 'level' }, { header: 'message', key: 'message' }, { header: 'advice', key: 'advice' }
        ],
        rows
      )
    };
  }
};

export const RESOURCE_NAMES = Object.keys(resources);

export function resolveResource(name) {
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(resources, name)) {
    throw new HttpError(404, 'Unknown resource', 'not_found');
  }
  return resources[name];
}
