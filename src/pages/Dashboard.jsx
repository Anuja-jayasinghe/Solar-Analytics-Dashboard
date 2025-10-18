// src/pages/Dashboard.jsx
import React from "react";
import DailyTargetTracker from "../components/dashboard/DailyTargetTracker";
import PeakPowerDial from "../components/dashboard/CurrentPower";
import MonthlyGenerationCard from "../components/dashboard/MonthlyGenerationCard";
import TotalGenerationCard from "../components/dashboard/TotalGenerationCard";
import TotalEarningsCard from "../components/dashboard/TotalEarningsCard";
import EnergyCharts from "../components/dashboard/EnergyCharts";
import EarningsBreakdown from "../components/dashboard/EarningsBreakdown";
import EnvironmentalImpact from "../components/dashboard/EnvironmentalImpact";
import SystemTrends from "../components/dashboard/SystemTrends";
import CacheStatusIndicator from "../components/CacheStatusIndicator";

function Dashboard() {
  return (
    <div style={pageStyle}>
      <CacheStatusIndicator />

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
        <EnergyCharts />
      </div>

      {/* --- Secondary Section --- */}
      <div style={gridStyle}>
        <EarningsBreakdown />
        <EnvironmentalImpact/>
        <SystemTrends />
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
};

export default Dashboard;
