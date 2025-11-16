// src/pages/Dashboard.jsx
import React, { Suspense, lazy } from "react";
import DailyTargetTracker from "../components/dashboard/DailyTargetTracker";
import PeakPowerDial from "../components/dashboard/CurrentPower";
import MonthlyGenerationCard from "../components/dashboard/MonthlyGenerationCard";
import TotalGenerationCard from "../components/dashboard/TotalGenerationCard";
import TotalEarningsCard from "../components/dashboard/TotalEarningsCard";
import CacheStatusIndicator from "../components/CacheStatusIndicator";
import ComingSoonNote from "../components/ComingSoonNote";
import RefreshIndicator from "../components/RefreshIndicator";
import ErrorBanner from "../components/ErrorBanner";
import AuthErrorModal from "../components/AuthErrorModal";
import CacheStats from "../components/CacheStats";
import ContextInspector from "../components/ContextInspector";
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
      <ComingSoonNote />
      <RefreshIndicator />
      <ErrorBanner />
      <AuthErrorModal />
      <CacheStats />
      <ContextInspector />

      {/* --- Upper Highlight Section --- */}
      <div style={highlightSection}>
      <div style={statsRow}>
          <MonthlyGenerationCard />
          <TotalGenerationCard />
          <TotalEarningsCard />
        </div>

        <div style={highlightCards}>
          <DailyTargetTracker />
          <PeakPowerDial />
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
  padding: "2rem",
  color: "#fff",
  maxWidth: "1300px",
  margin: "auto",
  fontFamily: "Inter, sans-serif",
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
  gap: "1.5rem",
  marginBottom: "2rem",
};

const highlightCards = {
  display: "flex",
  gap: "1.5rem",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const statsRow = {
  display: "flex",
  gap: "1.5rem",
  justifyContent: "space-between",
  flexWrap: "wrap",
  "@media (max-width: 768px)": {
    flexDirection: "column",
    gap: "1rem",
  },
};

const mainCharts = {
  marginTop: "1rem",
  background: "var(--card-bg)",
  borderRadius: "12px",
  backdropFilter: "blur(10px)",
  padding: "1rem",
  boxShadow: "0 0 25px var(--card-shadow)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "1rem",
  marginTop: "2rem",
  alignItems: "stretch",
  width: "100%",
  "@media (max-width: 768px)": {
    gridTemplateColumns: "1fr",
    gap: "1rem",
    marginTop: "1.5rem",
  },
  "@media (min-width: 769px) and (max-width: 1024px)": {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
};

export default Dashboard;
