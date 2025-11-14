import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import { createClient } from "@supabase/supabase-js";
import { useInView } from 'react-intersection-observer'; // 1. Import the hook

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const EnergyCharts = () => {
  // 2. Set up the inView hook
  const { ref, inView } = useInView({
    triggerOnce: true, // Only animate once
    threshold: 0.1,    // Trigger when 10% of the chart is visible
  });
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: alignedData, error: rpcError } = await supabase.rpc('get_monthly_comparison');
      if (rpcError) throw rpcError;
      const formattedData = alignedData.map(d => ({
        month: d.month_label,
        inverter: d.inverter_kwh,
        ceb: d.ceb_kwh
      }));
      setData(formattedData);
    } catch (err) {
      console.error("Error fetching energy chart data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 3. Updated Tooltip to be clearer
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyle}>
          <p style={tooltipLabelStyle}>Billing Period:</p>
          <p style={tooltipValueStyle}>{label}</p>
          <div style={{marginTop: '8px'}}>
            <p style={{ margin: '4px 0 0', padding: 0, color: '#00c2a8' }}>
              {`Inverter: ${payload[0].value.toFixed(2)} kWh`}
            </p>
            <p style={{ margin: '4px 0 0', padding: 0, color: '#ff7a00' }}>
              {`CEB: ${payload[1].value.toFixed(2)} kWh`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };
  
  return (
    // 4. Attach the 'ref' to the main container
    <div className="chart-container" style={chartBox} ref={ref}>
      <style>{keyframesCSS}</style>
      <div style={chartHeader}>
        <h2 style={{ margin: 0 }}>Monthly Energy Summary</h2>
      </div>

      {loading ? (
        <div style={messageContainer}>
          <div style={spinner}></div>
          <p>Loading energy data...</p>
        </div>
      ) : error ? (
        <div style={messageContainer}>
          <p style={{color: '#f56565'}}>Failed to load data.</p>
          <button onClick={fetchData} style={retryButton}>Try Again</button>
        </div>
      ) : data.length === 0 ? (
        <div style={messageContainer}><p>No energy data available</p></div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            {/* 5. Pass isAnimationActive={inView} to trigger animation */}
            <BarChart data={data} isAnimationActive={inView}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
              {/* 6. Updated XAxis for long labels */}
              <XAxis 
                dataKey="month" 
                stroke="var(--chart-text)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                angle={-25}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis stroke="var(--chart-text)" fontSize={12} />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-color)', paddingTop: '20px' }} />
              <Bar 
                dataKey="inverter" 
                fill="#00c2a8" 
                name="Inverter (kWh)"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 194, 168, 0.3))' }}
                // Removed hover effects for a cleaner look
              />
              <Bar 
                dataKey="ceb" 
                fill="#ff7a00" 
                name="CEB (kWh)"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(255, 122, 0, 0.3))' }}
              />
            </BarChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={250} style={{ marginTop: "2rem" }}>
            {/* 5. Pass isAnimationActive={inView} to trigger animation */}
            <LineChart data={data} isAnimationActive={inView}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
              {/* 6. Updated XAxis for long labels */}
              <XAxis 
                dataKey="month" 
                stroke="var(--chart-text)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                angle={-25}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis stroke="var(--chart-text)" fontSize={12} />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-color)', paddingTop: '20px' }} />
              <Line 
                type="monotone" 
                dataKey="inverter" 
                name="Inverter (kWh)"
                stroke="#00c2a8" 
                strokeWidth={3}
                dot={{ fill: '#00c2a8', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#00c2a8', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
              />
              <Line 
                type="monotone" 
                dataKey="ceb" 
                name="CEB (kWh)"
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

// --- Styles (from your original component) ---
const chartBox = {
  background: "var(--card-bg)",
  borderRadius: "24px",
  padding: "1.5rem",
  boxShadow: "0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05)",
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-color, #fff)',
  height: 'auto', // Auto-height to fit both charts
  minHeight: '400px', // Set a min-height for loading state
  flex: 2,
};
const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
  color: 'var(--accent, #00eaff)',
  textShadow: '0 0 10px var(--accent, #00eaff)',
};
const messageContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "550px", // Set a fixed height for loading/error
  color: "var(--text-color, #a0aec0)",
};
const spinner = {
  width: "40px",
  height: "40px",
  border: "3px solid rgba(255,255,255,0.1)",
  borderTop: "3px solid var(--accent, #00eaff)",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: "1rem",
};
const retryButton = {
  background: "rgba(0, 234, 255, 0.2)",
  color: "#fff",
  border: "1px solid rgba(0, 234, 255, 0.4)",
  borderRadius: "6px",
  padding: "0.4rem 0.8rem",
  fontSize: "0.9rem",
  cursor: "pointer",
  marginTop: "1rem",
  transition: "all 0.2s ease",
};
const keyframesCSS = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

// --- New Tooltip Styles ---
const tooltipStyle = {
  background: 'rgba(10, 10, 12, 0.85)',
  backdropFilter: 'blur(5px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};
const tooltipLabelStyle = {
  margin: 0,
  padding: 0,
  color: '#a0aec0',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  marginBottom: '4px',
};
const tooltipValueStyle = {
  margin: 0,
  padding: 0,
  fontWeight: 'bold',
  fontSize: '1rem',
  color: '#fff',
  marginBottom: '8px',
};

export default EnergyCharts;