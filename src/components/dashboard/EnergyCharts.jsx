import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, 
  CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import { useData } from "../../contexts/DataContext"; // You are using this context

const EnergyCharts = () => {
  const { energyChartsData, loading, errors, refreshData } = useData();

  const data = energyChartsData || [];

  // Custom themed tooltip for a consistent look
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={styles.tooltip}>
          <p style={{ margin: 0, padding: 0, fontWeight: 'bold' }}>{label}</p>
          {payload.map((pld, index) => (
            <p key={index} style={{ margin: '4px 0 0', padding: 0, color: pld.color }}>
              {`${pld.name}: ${pld.value.toFixed(2)} kWh`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={styles.container}>
      <style>{keyframesCSS}</style>
      <div style={styles.header}>
        <h2 style={styles.title}>Monthly Energy Summary</h2>
        <div style={styles.headerActions}>
          {loading.charts && <span style={styles.loadingText}>Loading...</span>}
          {errors.charts && (
            <button 
              onClick={() => refreshData('charts')} 
              style={styles.retryButton}
              title="Retry loading data"
            >
              ⚠️ Retry
            </button>
          )}
        </div>
      </div>

      <div style={styles.chartsContainer}>
        {loading.charts ? (
          <div style={styles.messageContainer}>
            <div style={styles.spinner}></div>
            <p>Loading energy data...</p>
          </div>
        ) : errors.charts ? (
          <div style={styles.messageContainer}>
            <p style={{color: '#f56565'}}>Failed to load: {errors.charts}</p>
            <button onClick={() => refreshData('charts')} style={styles.retryButton}>
              Try Again
            </button>
          </div>
        ) : data.length === 0 ? (
          <div style={styles.messageContainer}>
            <p>No energy data available</p>
          </div>
        ) : (
          <>
            {/* Bar Chart */}
            <div style={styles.chartWrapper}>
              <h3 style={styles.chartTitle}>Bar Chart</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="month" stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Legend wrapperStyle={{ color: '#a0aec0', bottom: 0 }} />
                  <Bar 
                    dataKey="inverter" 
                    fill="#00c2a8" 
                    name="Inverter (kWh)" 
                    radius={[4, 4, 0, 0]}
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
                    radius={[4, 4, 0, 0]}
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
            </div>

            {/* Line Chart */}
            <div style={styles.chartWrapper}>
              <h3 style={styles.chartTitle}>Line Chart</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="month" stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Legend wrapperStyle={{ color: '#a0aec0', bottom: 0 }} />
                  <Line 
                    type="monotone" 
                    dataKey="inverter" 
                    name="Inverter (kWh)" 
                    stroke="#00c2a8" 
                    strokeWidth={3}
                    dot={{ fill: '#00c2a8', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6, stroke: '#00c2a8', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
                    style={{filter: 'drop-shadow(0 0 5px #00c2a8)'}}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ceb" 
                    name="CEB (kWh)" 
                    stroke="#ff7a00" 
                    strokeWidth={3}
                    dot={{ fill: '#ff7a00', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6, stroke: '#ff7a00', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
                    style={{filter: 'drop-shadow(0 0 5px #ff7a00)'}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- STYLES (Matched with other dashboard components) ---
const styles = {
  container: {
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px',
    padding: '1.5rem',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    flexShrink: 0,
  },
  title: {
    color: 'var(--accent, #00eaff)',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    textShadow: '0 0 10px var(--accent, #00eaff)',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontStyle: 'italic',
  },
  chartsContainer: {
    display: 'flex',
    gap: '2rem',
    flexGrow: 1,
  },
  chartWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chartTitle: {
    color: 'var(--accent, #00eaff)',
    fontWeight: 'bold',
    fontSize: '1rem',
    textShadow: '0 0 8px var(--accent, #00eaff)',
    margin: '0 0 1rem 0',
    textAlign: 'center',
  },
  messageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: '#a0aec0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid var(--accent, #00eaff)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },
  retryButton: {
    background: 'rgba(0, 234, 255, 0.2)',
    color: '#fff',
    border: '1px solid rgba(0, 234, 255, 0.4)',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    marginTop: '1rem',
    transition: 'all 0.2s ease',
  },
  tooltip: {
    background: 'rgba(10, 10, 12, 0.85)',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
  },
};

const keyframesCSS = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

export default EnergyCharts;
