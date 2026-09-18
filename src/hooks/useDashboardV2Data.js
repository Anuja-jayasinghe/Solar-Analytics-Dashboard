// src/hooks/useDashboardV2Data.js
//
// Composes the redesigned dashboard's extra data needs on top of the existing DataContext.
// Deliberately does not touch DataContext, cacheService, or the polling/retry machinery that
// backs the production dashboard — this fetches independently so the preview page can never
// affect the real one's behaviour.
//
// Also owns the interactive state behind the Day/Week/Month and Month/Year toggles — see the
// comments on dailyMode and comparisonMode below for what each actually does and why "Day"
// is disabled on the comparison chart rather than faking a daily CEB figure that doesn't exist.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from './useData';
import {
  buildDailySeries,
  fetchDailySeriesInputs,
  buildMonthSummarySeries,
  fetchMonthSummaryInputs,
  buildOverlapSeries,
  buildYearlyOverlapSeries,
  fetchYearlyOverlapInputs,
  fetchIncomeComparisonInputs,
  computeIncomeComparison,
  fetchWeatherForecast
} from '../lib/dashboardV2Data';

const DAY_WINDOW = 5;
const WEEK_WINDOW = 7;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useDashboardV2Data() {
  const {
    energyChartsData,
    livePowerData,
    inverterPotentialValue,
    totalEarningsData,
    selectedYear,
    setSelectedYear,
    loading: baseLoading
  } = useData();

  const today = useMemo(() => startOfDay(new Date()), []);
  const currentYear = today.getFullYear();

  // ==========================================================================
  // Daily generation — Day / Week / Month
  // ==========================================================================
  //
  // Day and Week are the same small-multiples view at different widths (5 vs 7 cards);
  // Month switches to a single chart, since 30 small-multiple cards would be unreadable.
  // dailyWindowEnd pages Day/Week through history; monthCursor pages Month through calendar
  // months. Both are capped so ‹ › can never step past today into the future.
  const [dailyMode, setDailyModeState] = useState('day');
  const [dailyWindowEnd, setDailyWindowEnd] = useState(today);
  const [monthCursor, setMonthCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const [dailySeries, setDailySeries] = useState(null);
  const [dailySeriesError, setDailySeriesError] = useState(null);
  const [monthSeries, setMonthSeries] = useState(null);
  const [monthSeriesError, setMonthSeriesError] = useState(null);

  const windowDays = dailyMode === 'week' ? WEEK_WINDOW : DAY_WINDOW;

  const setDailyMode = useCallback((mode) => {
    setDailyModeState(mode);
    // Reset to "now" on every mode switch rather than trying to translate a day-window
    // position into a month position (or vice versa) — there's no meaningful mapping between
    // "5 days ending the 12th" and "which month was open", so don't pretend there is one.
    setDailyWindowEnd(today);
    setMonthCursor({ year: today.getFullYear(), month: today.getMonth() });
  }, [today]);

  const stepDaily = useCallback((direction) => {
    if (dailyMode === 'month') {
      setMonthCursor((cur) => {
        const next = new Date(cur.year, cur.month + direction, 1);
        // Never page into a month that hasn't started yet.
        if (next.getFullYear() > today.getFullYear() ||
            (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth())) {
          return cur;
        }
        return { year: next.getFullYear(), month: next.getMonth() };
      });
    } else {
      setDailyWindowEnd((cur) => {
        const next = new Date(cur);
        next.setDate(next.getDate() + direction * windowDays);
        return next.getTime() > today.getTime() ? today : next;
      });
    }
  }, [dailyMode, windowDays, today]);

  const canStepDailyForward = dailyMode === 'month'
    ? monthCursor.year < today.getFullYear() || monthCursor.month < today.getMonth()
    : dailyWindowEnd.getTime() < today.getTime();

  useEffect(() => {
    if (dailyMode === 'month') return;
    let cancelled = false;
    fetchDailySeriesInputs(windowDays, dailyWindowEnd)
      .then(({ liveRows, summaryRows, windowEnd }) => {
        if (cancelled) return;
        setDailySeries(buildDailySeries(liveRows, summaryRows, windowDays, windowEnd, today, livePowerData?.dailyGeneration));
      })
      .catch((err) => { if (!cancelled) setDailySeriesError(err); });
    return () => { cancelled = true; };
    // livePowerData?.dailyGeneration deliberately omitted — it ticks on every live poll and
    // would otherwise refetch the whole window each time. Today's running total is patched
    // onto the already-fetched series below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyMode, windowDays, dailyWindowEnd, today]);

  useEffect(() => {
    if (dailyMode !== 'month') return;
    let cancelled = false;
    fetchMonthSummaryInputs(monthCursor.year, monthCursor.month)
      .then((summaryRows) => {
        if (cancelled) return;
        setMonthSeries(buildMonthSummarySeries(summaryRows, monthCursor.year, monthCursor.month, today));
      })
      .catch((err) => { if (!cancelled) setMonthSeriesError(err); });
    return () => { cancelled = true; };
  }, [dailyMode, monthCursor, today]);

  // Patch today's running total onto the fetched series as it ticks, without refetching.
  const patchedDailySeries = dailySeries?.map((day) =>
    day.isToday && Number.isFinite(livePowerData?.dailyGeneration?.value)
      ? { ...day, totalKwh: livePowerData.dailyGeneration.value }
      : day
  ) ?? null;
  const patchedMonthSeries = monthSeries?.map((day) =>
    day.isToday && Number.isFinite(livePowerData?.dailyGeneration?.value)
      ? { ...day, totalKwh: livePowerData.dailyGeneration.value }
      : day
  ) ?? null;

  const dailyRangeLabel = dailyMode === 'month'
    ? new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : (() => {
        const start = new Date(dailyWindowEnd);
        start.setDate(start.getDate() - (windowDays - 1));
        const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return `${fmt(start)} – ${fmt(dailyWindowEnd)}`;
      })();

  // ==========================================================================
  // Generation vs CEB — Month / Year
  // ==========================================================================
  //
  // "Day" is deliberately not an option here: CEB bills a period, not a day, so there is no
  // real daily CEB figure to plot against inverter output without inventing one (e.g.
  // dividing a monthly bill by the number of days in it, which would misrepresent an actual
  // billing event as something CEB never measured or charged that granularly).
  const [comparisonMode, setComparisonMode] = useState('month');
  const [yearlySeries, setYearlySeries] = useState(null);
  const [yearlySeriesError, setYearlySeriesError] = useState(null);

  const stepComparisonYear = useCallback((direction) => {
    setSelectedYear((y) => Math.min(y + direction, currentYear));
  }, [setSelectedYear, currentYear]);

  useEffect(() => {
    if (comparisonMode !== 'year') return;
    let cancelled = false;
    // Every calendar year with at least a partial history — cheap (12 rows x N years from
    // already-tested, already-cached logic) and lets a newly-arriving complete year appear
    // without a code change. This project's data starts 2024-09-05, so 3 years back is
    // already more than enough headroom.
    const years = [currentYear - 2, currentYear - 1, currentYear];
    fetchYearlyOverlapInputs(years)
      .then((yearRowsList) => { if (!cancelled) setYearlySeries(buildYearlyOverlapSeries(yearRowsList)); })
      .catch((err) => { if (!cancelled) setYearlySeriesError(err); });
    return () => { cancelled = true; };
  }, [comparisonMode, currentYear]);

  const monthOverlapSeries = buildOverlapSeries(energyChartsData);
  const comparisonSeries = comparisonMode === 'year' ? yearlySeries : monthOverlapSeries;
  const comparisonRangeLabel = comparisonMode === 'year' ? null : String(selectedYear);

  // ==========================================================================
  // Income comparison (unchanged)
  // ==========================================================================
  const [income, setIncome] = useState(null);
  const [incomeError, setIncomeError] = useState(null);
  const [tariff, setTariff] = useState(null);

  useEffect(() => {
    if (!energyChartsData || energyChartsData.length === 0) return;
    let cancelled = false;
    fetchIncomeComparisonInputs(energyChartsData)
      .then(({ lastFinalizedRow, lastBillEarnings, tariff: fetchedTariff }) => {
        if (cancelled) return;
        setTariff(fetchedTariff);
        setIncome(
          computeIncomeComparison({
            lastFinalizedRow,
            lastBillEarnings,
            tariff: fetchedTariff,
            lifetimeExpected: inverterPotentialValue?.total,
            lifetimeActual: totalEarningsData?.total
          })
        );
      })
      .catch((err) => { if (!cancelled) setIncomeError(err); });
    return () => { cancelled = true; };
  }, [energyChartsData, inverterPotentialValue?.total, totalEarningsData?.total]);

  // ==========================================================================
  // Weather (unchanged)
  // ==========================================================================
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchWeatherForecast()
      .then((data) => { if (!cancelled) setWeather(data); })
      .catch((err) => { if (!cancelled) setWeatherError(err); });
    return () => { cancelled = true; };
  }, []);

  return {
    // Daily generation
    dailyMode,
    setDailyMode,
    stepDaily,
    canStepDailyForward,
    dailyRangeLabel,
    dailySeries: dailyMode === 'month' ? null : patchedDailySeries,
    dailySeriesError,
    dailySeriesLoading: dailyMode !== 'month' && dailySeries === null && !dailySeriesError,
    monthSeries: dailyMode === 'month' ? patchedMonthSeries : null,
    monthSeriesError,
    monthSeriesLoading: dailyMode === 'month' && monthSeries === null && !monthSeriesError,

    // Generation vs CEB
    comparisonMode,
    setComparisonMode,
    comparisonSeries,
    comparisonRangeLabel,
    stepComparisonYear,
    canStepComparisonForward: comparisonMode === 'month' && selectedYear < currentYear,
    canStepComparisonBack: comparisonMode === 'month',
    yearlySeriesError,

    // Income
    income,
    incomeError,
    incomeLoading: income === null && !incomeError && energyChartsData?.length > 0,
    tariff,

    // Weather
    weather,
    weatherError,

    // Passed through so panels can share the same loading semantics as the rest of the app.
    liveLoading: baseLoading.live,
    livePowerData
  };
}
