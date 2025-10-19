import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client directly in this component
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const EnergyCharts = () => {
  const [view, setView] = useState("bar");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- NEW: Self-contained data fetching logic ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ Directly call the correct RPC function
      const { data: alignedData, error: rpcError } = await supabase.rpc('get_monthly_comparison');

      if (rpcError) throw rpcError;

      // Map the database keys to the keys the chart expects
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
  
  // --- The rest of your component remains unchanged ---

  return (
    <div className="chart-container" style={chartBox}>
      <style>{keyframesCSS}</style>
      <div style={chartHeader}>
        <h2 style={{ margin: 0 }}>
          {view === "monthly" ? "Monthly Energy Summary" : "Yearly Overview"}
        </h2>
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

// --- Styles (from your original component) ---
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
const messageContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "300px",
  color: "var(--text-color)",
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

export default EnergyCharts;