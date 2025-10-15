// src/pages/Dashboard.jsx
import React from "react";
import DashboardOverview from "../components/dashboard/DashboardOverview";
import EnergyCharts from "../components/dashboard/EnergyCharts";
import EarningsBreakdown from "../components/dashboard/EarningsBreakdown";
import SystemTrends from "../components/dashboard/SystemTrends";

function Dashboard() {
  return (
    <div style={pageStyle}>
      <h1 style={headerStyle}>⚡ Solar Analytics Dashboard</h1>

      {/* Overview Cards */}
      <DashboardOverview />

      {/* Main Charts */}
      <EnergyCharts />

      {/* Lower Grid Section */}
      <div style={gridStyle}>
        <EarningsBreakdown />
        <SystemTrends />
      </div>
    </div>
  );
}

// --- Styles ---
const pageStyle = {
  padding: "2rem",
  color: "#fff",
  maxWidth: "1200px",
  margin: "0 auto",
};

const headerStyle = {
  color: "var(--accent)",
  marginBottom: "1.5rem",
  textShadow: "0 0 8px rgba(255,122,0,0.3)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2rem",
  marginTop: "2rem",
};

export default Dashboard;
