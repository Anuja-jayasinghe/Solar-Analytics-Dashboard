import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const SystemTrends = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("inverter_data_daily_summary")
          .select("summary_date, total_generation_kwh, peak_power_kw")
          .order("summary_date", { ascending: false })
          .limit(10);

        if (error) throw error;
        
        const formattedData = data.map(row => ({
          ...row,
          date: new Date(row.summary_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
        })).reverse();

        setChartData(formattedData);
      } catch (err) {
        console.error("Error fetching trend data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, []);

  // --- NEW: Calculate peak power stats ---
  const { highestPeak, averagePeak } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { highestPeak: 0, averagePeak: 0 };
    }
    const peakValues = chartData.map(d => d.peak_power_kw).filter(Boolean); // Filter out null/undefined
    if (peakValues.length === 0) {
      return { highestPeak: 0, averagePeak: 0 };
    }
    const highest = Math.max(...peakValues);
    const average = peakValues.reduce((sum, val) => sum + val, 0) / peakValues.length;
    return { highestPeak: highest, averagePeak: average };
  }, [chartData]);

  // Custom Tooltip for the line graph
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={styles.tooltip}>
          <p style={{ margin: 0, padding: 0, color: 'var(--text-secondary)' }}>Date: {label}</p>
          <p style={{ margin: '4px 0 0', padding: 0, color: 'var(--accent)' }}>
            {`Total: ${payload[0].value.toFixed(2)} kWh`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container" style={styles.container}>
      <h2 style={styles.title}>Recent Trends</h2>
      <div style={styles.chartContainer}>
        {loading && <p style={styles.loadingText}>Loading Trends...</p>}
        {!loading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 0, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" stroke="var(--chart-text)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--accent)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--glass-border)' }} />
              {/* Legend removed to preserve space within fixed height */}
              <Line 
                type="monotone" 
                dataKey="total_generation_kwh" 
                name="Total Generation (kWh)"
                stroke="var(--accent)" 
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--accent)' }}
                activeDot={{ r: 8, stroke: 'rgba(255, 122, 0, 0.3)', strokeWidth: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* --- NEW: Peak Power Stats Section --- */}
      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Highest Peak</p>
          <p style={styles.statValue}>{highestPeak.toFixed(2)} <span style={styles.unit}>kW</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Average Peak</p>
          <p style={styles.statValue}>{averagePeak.toFixed(2)} <span style={styles.unit}>kW</span></p>
        </div>
      </div>
    </div>
  );
};

// --- STYLES (Matched with other dashboard components) ---
const styles = {
  container: {
    background: 'var(--card-bg)',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 0 20px var(--card-shadow)',
    width: '90%',
    margin: 0,
    height: '360px',
    display: 'flex', overflow: 'hidden',
    flexDirection: 'column',
  },
  title: {
    color: 'var(--accent)',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    textAlign: 'center',
    margin: '0 0 1rem 0',
  },
  chartContainer: {
    flexGrow: 1,
    width: '100%',
    paddingRight:"1rem",
    paddingTop:"2.5rem",
  },
  loadingText: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: 'auto',
  },
  tooltip: {
    background: 'var(--chart-tooltip-bg)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    boxShadow: '0 4px 12px var(--card-shadow)',
  },
  statsContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: '1.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--glass-border)',
  },
  statItem: {
    textAlign: 'center',
  },
  statLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  statValue: {
    color: 'var(--accent)',
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  unit: {
    fontSize: '0.875rem',
    opacity: 0.8,
  },
  divider: {
    width: '1px',
    height: '2rem',
    backgroundColor: 'var(--glass-border)',
  }
};

export default SystemTrends;