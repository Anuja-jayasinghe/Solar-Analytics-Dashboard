import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import { useData } from "../../contexts/DataContext";

const EnergyCharts = () => {
  const [view, setView] = useState("monthly");
  const { energyChartsData, loading, errors, refreshData } = useData();

  // Use data from context
  const data = energyChartsData || [];

  return (
    <div className="chart-container" style={chartBox}>
      <div style={chartHeader}>
        <h2 style={{ margin: 0 }}>
          {view === "monthly" ? "Monthly Energy Summary" : "Yearly Overview"}
        </h2>
        <div style={headerActions}>
          {loading.charts && <span style={loadingText}>Loading...</span>}
          {errors.charts && (
            <button 
              onClick={() => refreshData('charts')} 
              style={retryButton}
              title="Retry loading data"
            >
              ⚠️ Retry
            </button>
          )}
        </div>
      </div>

      {loading.charts ? (
        <div style={loadingContainer}>
          <div style={spinner}></div>
          <p>Loading energy data...</p>
        </div>
      ) : errors.charts ? (
        <div style={errorContainer}>
          <p>Failed to load energy data: {errors.charts}</p>
          <button onClick={() => refreshData('charts')} style={retryButton}>
            Try Again
          </button>
        </div>
      ) : data.length === 0 ? (
        <div style={emptyContainer}>
          <p>No energy data available</p>
        </div>
      ) : (
        <>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" stroke="var(--chart-text)" />
          <YAxis stroke="var(--chart-text)" />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-tooltip-border)',
              borderRadius: '8px',
              color: 'var(--text-color)',
              boxShadow: '0 4px 12px var(--card-shadow)',
              backdropFilter: 'blur(10px)'
            }}
            labelStyle={{ color: 'var(--text-color)', fontWeight: '600' }}
            itemStyle={{ color: 'var(--text-color)' }}
          />
          <Legend 
            wrapperStyle={{ color: 'var(--text-color)' }}
          />
          <Bar 
            dataKey="inverter" 
            fill="#00c2a8" 
            name="Inverter (kWh)"
            style={{ 
              filter: 'drop-shadow(0 2px 4px rgba(0, 194, 168, 0.3))',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.filter = 'brightness(1.3) drop-shadow(0 4px 8px rgba(0, 194, 168, 0.5))';
            }}
            onMouseLeave={(e) => {
              e.target.style.filter = 'drop-shadow(0 2px 4px rgba(0, 194, 168, 0.3))';
            }}
          />
          <Bar 
            dataKey="ceb" 
            fill="#ff7a00" 
            name="CEB (kWh)"
            style={{ 
              filter: 'drop-shadow(0 2px 4px rgba(255, 122, 0, 0.3))',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.filter = 'brightness(1.3) drop-shadow(0 4px 8px rgba(255, 122, 0, 0.5))';
            }}
            onMouseLeave={(e) => {
              e.target.style.filter = 'drop-shadow(0 2px 4px rgba(255, 122, 0, 0.3))';
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={250} style={{ marginTop: "2rem" }}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" stroke="var(--chart-text)" />
          <YAxis stroke="var(--chart-text)" />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-tooltip-border)',
              borderRadius: '8px',
              color: 'var(--text-color)',
              boxShadow: '0 4px 12px var(--card-shadow)',
              backdropFilter: 'blur(10px)'
            }}
            labelStyle={{ color: 'var(--text-color)', fontWeight: '600' }}
            itemStyle={{ color: 'var(--text-color)' }}
          />
          <Legend 
            wrapperStyle={{ color: 'var(--text-color)' }}
          />
          <Line 
            type="monotone" 
            dataKey="inverter" 
            stroke="#00c2a8" 
            strokeWidth={3}
            dot={{ fill: '#00c2a8', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#00c2a8', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
          />
          <Line 
            type="monotone" 
            dataKey="ceb" 
            stroke="#ff7a00" 
            strokeWidth={3}
            dot={{ fill: '#ff7a00', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#ff7a00', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
          />
        </LineChart>
      </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

const chartBox = {
  background: "var(--card-bg)",
  borderRadius: "10px",
  padding: "1.5rem",
  boxShadow: "0 0 20px var(--card-shadow)",
};
const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
};

const headerActions = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const loadingText = {
  color: "var(--text-secondary)",
  fontSize: "0.9rem",
  fontStyle: "italic",
};

const retryButton = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "6px",
  padding: "0.3rem 0.6rem",
  fontSize: "0.8rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const loadingContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  color: "var(--text-secondary)",
};

const spinner = {
  width: "40px",
  height: "40px",
  border: "3px solid var(--chart-grid)",
  borderTop: "3px solid var(--accent)",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: "1rem",
};

const errorContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  color: "var(--error-color, #ff6b6b)",
  textAlign: "center",
};

const emptyContainer = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  color: "var(--text-secondary)",
  fontStyle: "italic",
};

// Add keyframes for spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default EnergyCharts;
