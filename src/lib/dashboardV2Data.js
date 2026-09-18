// src/lib/dashboardV2Data.js
//
// Data plumbing for the redesigned dashboard (docs/UI_REDESIGN_DIRECTION.md).
//
// Pure functions here are unit-tested in tests/dashboardV2Data.test.js. The async fetchers
// deliberately do NOT touch cacheService or the existing DataContext polling machinery —
// this is a preview surface, reachable only at /dashboard/v2 behind the same auth gate as
// the real dashboard, and keeping it separate means nothing here can affect the production
// dashboard's caching or retry behaviour.
//
// Every anon read here already has RLS SELECT granted — verified live against the anon key
// before this was written, the same way the rest of this project verifies rather than assumes.

import { supabase } from './supabaseClient';

// This project is single-site (CLAUDE.md: "Single site, single inverter"), so the plant's
// coordinates are fixed metadata, not user input — same fallback-constant pattern as
// gridCapacity's default of 40 kW elsewhere in this codebase.
export const PLANT_LOCATION = { lat: 7.0713, lon: 80.0088 };

function toDateOnlyLocal(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function localIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// Daily generation — small multiples over N consecutive days
// ============================================================================
//
// inverter_data_live turned out to collect far more sparsely than its 5-minute name and cron
// schedule imply (as few as 3-4 samples across a whole day, at irregular hours — GitHub's
// documented behaviour for sub-15-minute cron schedules under load, not a bug in the workflow
// itself). Rather than interpolate across the gaps or invent evenly-spaced samples, each
// day's shape is built from exactly the timestamped samples that exist. Sparse stays visibly
// sparse: fabricating smoothness here would be the same mistake this project has already been
// burned by twice with fabricated zeros, just wearing a hovercraft of hourly buckets.
//
// The per-day TOTAL and PEAK shown on each card come from inverter_data_daily_summary
// instead of the live samples — that table is written by a dedicated aggregation job and is
// the reliable figure regardless of how sparse the live table's sampling happened to be that
// day.

/**
 * @param {Array<{data_timestamp: string, power_ac: number}>} liveRows
 * @param {Array<{summary_date: string, total_generation_kwh: number, peak_power_kw: number}>} summaryRows
 * @param {number} days
 * @param {Date} today
 * @param {{value: number}|null} liveDailyGeneration  today's running total from the live edge
 *   function (DataContext's livePowerData.dailyGeneration) — there is no daily_summary row for
 *   today until the aggregation job runs, so today's total comes from the live reading instead.
 */
export function buildDailySeries(liveRows, summaryRows, days, today, liveDailyGeneration) {
  const normalizedToday = toDateOnlyLocal(today);
  const summaryByDate = new Map((summaryRows || []).map((r) => [r.summary_date, r]));

  const samplesByDate = new Map();
  for (const row of liveRows || []) {
    const ts = new Date(row.data_timestamp);
    if (Number.isNaN(ts.getTime())) continue;
    const dateKey = localIsoDate(toDateOnlyLocal(ts));
    const hour = ts.getHours() + ts.getMinutes() / 60;
    const kw = Number(row.power_ac);
    if (!Number.isFinite(kw)) continue;
    if (!samplesByDate.has(dateKey)) samplesByDate.set(dateKey, []);
    samplesByDate.get(dateKey).push({ hour, kw });
  }
  for (const points of samplesByDate.values()) points.sort((a, b) => a.hour - b.hour);

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(normalizedToday);
    date.setDate(date.getDate() - i);
    const dateKey = localIsoDate(date);
    const isToday = dateKey === localIsoDate(normalizedToday);
    const points = samplesByDate.get(dateKey) || [];
    const summary = summaryByDate.get(dateKey) || null;

    const peakFromSamples = points.length
      ? Math.max(...points.map((p) => p.kw))
      : null;

    out.push({
      date: dateKey,
      isToday,
      label: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
      // null (not 0) when we genuinely don't know the total yet — today before the live
      // reading arrives, or a day the daily-summary job hasn't covered.
      totalKwh: isToday
        ? (Number.isFinite(liveDailyGeneration?.value) ? liveDailyGeneration.value : null)
        : (summary ? Number(summary.total_generation_kwh) : null),
      peakKw: isToday
        ? peakFromSamples
        : (summary && Number.isFinite(Number(summary.peak_power_kw)) ? Number(summary.peak_power_kw) : peakFromSamples),
      points,
      sampleCount: points.length
    });
  }
  return out;
}

export async function fetchDailySeriesInputs(days = 5) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const [{ data: liveRows, error: liveError }, { data: summaryRows, error: summaryError }] = await Promise.all([
    supabase
      .from('inverter_data_live')
      .select('data_timestamp, power_ac')
      .gte('data_timestamp', startIso)
      .order('data_timestamp', { ascending: true }),
    supabase
      .from('inverter_data_daily_summary')
      .select('summary_date, total_generation_kwh, peak_power_kw')
      .gte('summary_date', localIsoDate(start))
      .order('summary_date', { ascending: true })
  ]);

  if (liveError) throw new Error(`inverter_data_live fetch failed: ${liveError.message}`);
  if (summaryError) throw new Error(`inverter_data_daily_summary fetch failed: ${summaryError.message}`);

  return { liveRows: liveRows || [], summaryRows: summaryRows || [], today };
}

// ============================================================================
// Generation vs CEB — kWh comparison (Option D, overlapping filled areas)
// ============================================================================
//
// Built from energyChartsData (DataContext), which is already LR-001-aligned and tested —
// this module never re-derives that alignment, only reshapes it for the chart.

/**
 * @param {Array} alignedRows  DataContext's energyChartsData — see buildAlignedEnergyComparisonRows
 * @returns {{points: Array, maxKwh: number, minKwh: number}}
 */
export function buildOverlapSeries(alignedRows) {
  const points = (alignedRows || [])
    .filter((r) => r.status !== 'pending' && r.inverter !== null)
    .map((r) => ({
      label: r.month,
      inverter: Number(r.inverter),
      // ceb stays null through provisional/missing_bill months — the CEB series must stop
      // there, not draw a fabricated value. null is not 0.
      ceb: r.ceb === null || r.ceb === undefined ? null : Number(r.ceb),
      status: r.status
    }));

  // Deliberately NOT clamped to 0. This chart exists to make a ~1-5% monthly shortfall
  // visible (the whole reason bar and line versions of this were rejected as "feels empty" —
  // the values are close enough that a 0-based axis flattens them into one indistinguishable
  // line). A tight domain around the actual values is what makes the overlap technique work;
  // the component adds a small padding fraction on top of this for headroom.
  const allValues = points.flatMap((p) => [p.inverter, p.ceb]).filter((v) => v !== null && Number.isFinite(v));
  const maxKwh = allValues.length ? Math.max(...allValues) : 0;
  const minKwh = allValues.length ? Math.min(...allValues) : 0;

  return { points, maxKwh, minKwh };
}

// ============================================================================
// Income comparison — should-have-been-paid vs actually paid
// ============================================================================

/**
 * @param {object} params
 * @param {object|null} params.lastFinalizedRow   last aligned row with status 'finalized'
 * @param {number|null} params.lastBillEarnings    ceb_data.earnings for that row's billDate
 * @param {number} params.tariff                   system_settings.rate_per_kwh
 * @param {number} params.lifetimeExpected         DataContext inverterPotentialValue.total
 * @param {number} params.lifetimeActual           DataContext totalEarningsData.total
 */
export function computeIncomeComparison({
  lastFinalizedRow,
  lastBillEarnings,
  tariff,
  lifetimeExpected,
  lifetimeActual
}) {
  const hasLastPeriod = !!lastFinalizedRow && Number.isFinite(tariff) && Number.isFinite(lastBillEarnings);

  const expectedLast = hasLastPeriod ? lastFinalizedRow.inverter * tariff : null;
  const actualLast = hasLastPeriod ? lastBillEarnings : null;
  const diffLast = hasLastPeriod ? actualLast - expectedLast : null;
  const diffPctLast = hasLastPeriod && expectedLast !== 0 ? (diffLast / expectedLast) * 100 : null;

  const hasLifetime = Number.isFinite(lifetimeExpected) && Number.isFinite(lifetimeActual);
  const lifetimeDiff = hasLifetime ? lifetimeActual - lifetimeExpected : null;

  return {
    periodLabel: lastFinalizedRow?.periodLabel ?? null,
    expectedLast,
    actualLast,
    diffLast,
    diffPctLast,
    lifetimeExpected: hasLifetime ? lifetimeExpected : null,
    lifetimeActual: hasLifetime ? lifetimeActual : null,
    lifetimeDiff
  };
}

/**
 * Fetches everything computeIncomeComparison needs beyond what DataContext already holds.
 */
export async function fetchIncomeComparisonInputs(alignedRows) {
  const lastFinalizedRow = [...(alignedRows || [])].reverse().find((r) => r.status === 'finalized') || null;

  const [{ data: tariffRow, error: tariffError }, billResult] = await Promise.all([
    supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_name', 'rate_per_kwh')
      .limit(1)
      .maybeSingle(),
    lastFinalizedRow?.billDate
      ? supabase
          .from('ceb_data')
          .select('earnings')
          .eq('bill_date', lastFinalizedRow.billDate)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (tariffError) throw new Error(`Tariff fetch failed: ${tariffError.message}`);
  if (billResult.error) throw new Error(`Bill earnings fetch failed: ${billResult.error.message}`);

  const tariff = parseFloat(tariffRow?.setting_value) || 37;
  const lastBillEarnings = billResult.data?.earnings ?? null;

  return { lastFinalizedRow, lastBillEarnings, tariff };
}

// ============================================================================
// Weather — Open-Meteo, explanatory context only
// ============================================================================
//
// docs/UI_REDESIGN_DIRECTION.md §7.2: validated against 242 days of this plant's own output
// at r²=0.53, ~13% typical error. That is fine for "why was yesterday dim" and NOT fine for
// any comparison figure — this function's output must never feed a variance, an expected-vs-
// actual number, or anything that looks like evidence. It only ever renders as a forecast
// strip. On any failure it returns null and the panel that calls it must hide itself — no
// placeholder weather.

export async function fetchWeatherForecast({ lat, lon } = PLANT_LOCATION) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'Asia/Colombo',
    forecast_days: '6',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    current: 'temperature_2m,relative_humidity_2m,weather_code'
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();

  return {
    current: {
      temperature: json.current?.temperature_2m ?? null,
      humidity: json.current?.relative_humidity_2m ?? null,
      weatherCode: json.current?.weather_code ?? null
    },
    daily: (json.daily?.time || []).map((date, i) => ({
      date,
      weatherCode: json.daily.weather_code?.[i] ?? null,
      tMax: json.daily.temperature_2m_max?.[i] ?? null,
      tMin: json.daily.temperature_2m_min?.[i] ?? null,
      sunrise: json.daily.sunrise?.[i] ?? null,
      sunset: json.daily.sunset?.[i] ?? null
    }))
  };
}

// WMO weather codes, collapsed to the handful this UI distinguishes visually.
export function weatherCodeToKind(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
}
