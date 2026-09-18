// src/hooks/useDashboardV2Data.js
//
// Composes the redesigned dashboard's extra data needs on top of the existing DataContext.
// Deliberately does not touch DataContext, cacheService, or the polling/retry machinery that
// backs the production dashboard — this fetches independently so the preview page can never
// affect the real one's behaviour.

import { useEffect, useState } from 'react';
import { useData } from './useData';
import {
  buildDailySeries,
  fetchDailySeriesInputs,
  buildOverlapSeries,
  fetchIncomeComparisonInputs,
  computeIncomeComparison,
  fetchWeatherForecast
} from '../lib/dashboardV2Data';

const DAILY_SERIES_DAYS = 5;

export function useDashboardV2Data() {
  const {
    energyChartsData,
    livePowerData,
    inverterPotentialValue,
    totalEarningsData,
    loading: baseLoading
  } = useData();

  const [dailySeries, setDailySeries] = useState(null);
  const [dailySeriesError, setDailySeriesError] = useState(null);

  const [income, setIncome] = useState(null);
  const [incomeError, setIncomeError] = useState(null);
  const [tariff, setTariff] = useState(null);

  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);

  // Daily generation small multiples
  useEffect(() => {
    let cancelled = false;
    fetchDailySeriesInputs(DAILY_SERIES_DAYS)
      .then(({ liveRows, summaryRows, today }) => {
        if (cancelled) return;
        const series = buildDailySeries(
          liveRows,
          summaryRows,
          DAILY_SERIES_DAYS,
          today,
          livePowerData?.dailyGeneration
        );
        setDailySeries(series);
      })
      .catch((err) => {
        if (!cancelled) setDailySeriesError(err);
      });
    return () => { cancelled = true; };
    // livePowerData?.dailyGeneration intentionally omitted: it updates every live poll and
    // would otherwise refetch the whole 5-day window on every tick. Today's total is instead
    // patched onto the already-fetched series in the memo below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patch just today's running total onto the fetched series as it ticks, without refetching.
  const patchedDailySeries = dailySeries?.map((day) =>
    day.isToday && Number.isFinite(livePowerData?.dailyGeneration?.value)
      ? { ...day, totalKwh: livePowerData.dailyGeneration.value }
      : day
  ) ?? null;

  // Generation vs CEB overlap series — pure reshape, no fetch needed.
  const overlapSeries = buildOverlapSeries(energyChartsData);

  // Income comparison
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
      .catch((err) => {
        if (!cancelled) setIncomeError(err);
      });
    return () => { cancelled = true; };
  }, [energyChartsData, inverterPotentialValue?.total, totalEarningsData?.total]);

  // Weather — explanatory only; a failure here hides the panel, it never blocks the page.
  useEffect(() => {
    let cancelled = false;
    fetchWeatherForecast()
      .then((data) => { if (!cancelled) setWeather(data); })
      .catch((err) => { if (!cancelled) setWeatherError(err); });
    return () => { cancelled = true; };
  }, []);

  return {
    dailySeries: patchedDailySeries,
    dailySeriesError,
    dailySeriesLoading: dailySeries === null && !dailySeriesError,

    overlapSeries,

    income,
    incomeError,
    incomeLoading: income === null && !incomeError && energyChartsData?.length > 0,
    tariff,

    weather,
    weatherError,

    // Passed through so panels can share the same loading semantics as the rest of the app.
    liveLoading: baseLoading.live,
    livePowerData
  };
}
