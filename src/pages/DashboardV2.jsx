// src/pages/DashboardV2.jsx
//
// Preview of the redesigned dashboard (docs/UI_REDESIGN_DIRECTION.md). Additive only: this
// file, everything under src/components/dashboardV2/, src/lib/dashboardV2Data.js and
// src/hooks/useDashboardV2Data.js are new. src/pages/Dashboard.jsx and every component it
// renders are UNTOUCHED, so the production dashboard at /dashboard keeps working exactly as
// it does today regardless of what happens here. Reachable at /dashboard/v2, behind the same
// auth gate as the real dashboard (src/pages/real/DashboardV2Real.jsx mirrors
// src/pages/real/DashboardReal.jsx's gating exactly).
//
// Every panel is wired to real data — see src/lib/dashboardV2Data.js and
// src/hooks/useDashboardV2Data.js for where each figure comes from and why. Nothing on this
// page is a placeholder number.

import React from 'react';
import { useData } from '../hooks/useData';
import { useDashboardV2Data } from '../hooks/useDashboardV2Data';
import RefreshIndicator from '../components/RefreshIndicator';
import ErrorBanner from '../components/ErrorBanner';
import AuthErrorModal from '../components/AuthErrorModal';
import LiveGauges from '../components/dashboardV2/LiveGauges';
import DailyGenerationPanel from '../components/dashboardV2/DailyGenerationPanel';
import GenerationVsCebChart from '../components/dashboardV2/GenerationVsCebChart';
import IncomeComparison from '../components/dashboardV2/IncomeComparison';
import WeatherStrip from '../components/dashboardV2/WeatherStrip';
import EnvironmentalImpactStrip from '../components/dashboardV2/EnvironmentalImpactStrip';
import '../components/dashboardV2/dv2-tokens.css';

const PLANT_NAME = 'CN00079 · 40 kW · SN 1811040244070066';

export default function DashboardV2() {
  const { livePowerData, gridCapacity, dailyGenerationTarget, environmentalImpact } = useData();
  const {
    dailySeries,
    dailySeriesError,
    dailySeriesLoading,
    overlapSeries,
    income,
    incomeError,
    incomeLoading,
    tariff,
    weather,
    weatherError
  } = useDashboardV2Data();

  const status = livePowerData?.status || 'Offline';
  const isOnline = status === 'Online';

  return (
    <div className="dv2" style={{ padding: '26px 30px', minHeight: '100%' }}>
      <div className="mobile-hidden">
        <RefreshIndicator />
      </div>
      <ErrorBanner />
      <AuthErrorModal />

      {/* topbar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Overview
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: isOnline ? 'var(--dv2-good-bg)' : 'var(--dv2-bad-bg)'
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? 'var(--dv2-good)' : 'var(--dv2-bad)' }} />
              <span className="dv2-mono" style={{ fontSize: 11, color: isOnline ? 'var(--dv2-good)' : 'var(--dv2-bad)' }}>
                {status.toUpperCase()}
              </span>
            </span>
          </div>
          <div className="dv2-mono" style={{ fontSize: 12, color: 'var(--dv2-ink-faint)', marginTop: 6 }}>{PLANT_NAME}</div>
        </div>
      </div>

      {/* Row A: daily generation (primary) + live gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <DailyGenerationPanel series={dailySeries} loading={dailySeriesLoading} error={dailySeriesError} />
        <LiveGauges
          currentPower={livePowerData?.currentPower?.value}
          status={status}
          gridCapacity={gridCapacity}
          todayKwh={livePowerData?.dailyGeneration?.value}
          dailyTarget={dailyGenerationTarget}
          tariff={tariff}
        />
      </div>

      {/* Row A2: generation vs CEB, kWh */}
      <div style={{ marginBottom: 18 }}>
        <GenerationVsCebChart series={overlapSeries} />
      </div>

      {/* Row B: income */}
      <div style={{ marginBottom: 18 }}>
        <IncomeComparison income={income} loading={incomeLoading} error={incomeError} />
      </div>

      {/* Row C: weather + environmental impact (minor) */}
      <div style={{ display: 'grid', gridTemplateColumns: weather ? '1.35fr 1fr' : '1fr', gap: 18 }}>
        <WeatherStrip weather={weather} error={weatherError} />
        <EnvironmentalImpactStrip co2Avoided={environmentalImpact?.co2Avoided} treesPlanted={environmentalImpact?.treesPlanted} />
      </div>
    </div>
  );
}
