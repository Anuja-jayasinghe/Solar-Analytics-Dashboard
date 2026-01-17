// src/pages/Dashboard.jsx
import React, { Suspense, lazy } from "react";
import DailyTargetTracker from "../components/dashboard/DailyTargetTracker";
import PeakPowerDial from "../components/dashboard/CurrentPower";
import MonthlyGenerationCard from "../components/dashboard/MonthlyGenerationCard";
import TotalGenerationCard from "../components/dashboard/TotalGenerationCard";
import TotalEarningsCard from "../components/dashboard/TotalEarningsCard";
import RefreshIndicator from "../components/RefreshIndicator";
import ErrorBanner from "../components/ErrorBanner";
import AuthErrorModal from "../components/AuthErrorModal";
import { ChartSkeleton, CardSkeleton } from "../components/SkeletonLoader";

// Lazy load heavy chart components
const EnergyCharts = lazy(() => import("../components/dashboard/EnergyCharts"));
const EarningsBreakdown = lazy(() => import("../components/dashboard/EarningsDifference"));
const EnvironmentalImpact = lazy(() => import("../components/dashboard/EnvironmentalImpact"));
const SystemTrends = lazy(() => import("../components/dashboard/SystemTrends"));

function Dashboard() {
  const content = (
    <div className="dashboard-page">
      <div className="mobile-hidden">
        <RefreshIndicator />
      </div>
      <ErrorBanner />
      <AuthErrorModal />

      {/* --- Upper Highlight Section --- */}
      <div className="highlight-section">
        {/* Stats cards below - side by side */}
        <div className="stats-row">
          <MonthlyGenerationCard />
          <TotalGenerationCard />
          <TotalEarningsCard />
        </div>

        {/* Live components first - side by side */}
        <div className="highlight-cards">
          <DailyTargetTracker />
          <PeakPowerDial />
        </div>
      </div>

      {/* --- Main Energy Analytics --- */}
      <div className="main-charts">
        <Suspense fallback={<ChartSkeleton />}>
          <EnergyCharts />
        </Suspense>
      </div>

      {/* --- Secondary Section --- */}
      <div className="secondary-grid">
        <Suspense fallback={<CardSkeleton />}>
          <EarningsBreakdown />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <EnvironmentalImpact />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <SystemTrends />
        </Suspense>
      </div>
    </div>
  );

  return content;
}

// --- Styles replaced by CSS classes ---
// check index.css for .dashboard-page, .highlight-section, etc.

export default Dashboard;
