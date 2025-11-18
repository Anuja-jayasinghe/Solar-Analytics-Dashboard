// src/pages/Dashboard.jsx
import React, { Suspense, lazy } from "react";
import DailyTargetTracker from "../components/dashboard/DailyTargetTracker";
import PeakPowerDial from "../components/dashboard/CurrentPower";
import MonthlyGenerationCard from "../components/dashboard/MonthlyGenerationCard";
import TotalGenerationCard from "../components/dashboard/TotalGenerationCard";
import TotalEarningsCard from "../components/dashboard/TotalEarningsCard";
import CacheStatusIndicator from "../components/CacheStatusIndicator";
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
  return (
    <div style={pageStyle}>
      <CacheStatusIndicator />
      <RefreshIndicator />
      <ErrorBanner />
      <AuthErrorModal />

      {/* --- Upper Highlight Section --- */}
      <div style={highlightSection}>
        {/* Live components first - side by side */}
        <div style={highlightCards}>
          <DailyTargetTracker />
          <PeakPowerDial />
        </div>

        {/* Stats cards below - side by side */}
        <div style={statsRow}>
          <MonthlyGenerationCard />
          <TotalGenerationCard />
          <TotalEarningsCard />
        </div>
      </div>

      {/* --- Main Energy Analytics --- */}
      <div style={mainCharts}>
        <Suspense fallback={<ChartSkeleton />}>
          <EnergyCharts />
        </Suspense>
      </div>

      {/* --- Secondary Section --- */}
      <div style={gridStyle}>
        <Suspense fallback={<CardSkeleton />}>
          <EarningsBreakdown />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <EnvironmentalImpact/>
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <SystemTrends />
        </Suspense>
      </div>
    </div>
  );
}

// --- Styles ---
const pageStyle = {
  padding: "clamp(0.75rem, 3vw, 2rem)",
  color: "#fff",
  maxWidth: "1300px",
  margin: "auto",
  fontFamily: "Inter, sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

const headerStyle = {
  color: "var(--accent)",
  marginBottom: "1.5rem",
  textShadow: "0 0 12px rgba(255,122,0,0.4)",
  fontWeight: "700",
  fontSize: "1.8rem",
};

const highlightSection = {
  display: "flex",
  flexDirection: "column",
  gap: "clamp(1rem, 2vw, 1.5rem)",
  marginBottom: "clamp(1rem, 3vw, 2rem)",
};

const highlightCards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 350px), 1fr))",
  gap: "clamp(1rem, 2vw, 1.5rem)",
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
  gap: "clamp(1rem, 2vw, 1.5rem)",
};

const mainCharts = {
  marginTop: "clamp(0.75rem, 2vw, 1rem)",
  background: "var(--card-bg)",
  borderRadius: "12px",
  backdropFilter: "blur(10px)",
  padding: "clamp(0.75rem, 2vw, 1rem)",
  boxShadow: "0 0 25px var(--card-shadow)",
  overflow: "hidden",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
  gap: "clamp(1rem, 2vw, 1.5rem)",
  marginTop: "clamp(1rem, 3vw, 2rem)",
  alignItems: "stretch",
  width: "100%",
};

export default Dashboard;
