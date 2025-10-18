import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import { supabase } from "../../lib/supabaseClient";

const EnergyCharts = () => {
  const [data, setData] = useState([]);
  const [view, setView] = useState("monthly");

  useEffect(() => {
    async function load() {
      const { data: inv } = await supabase
        .from("inverter_data_monthly_summary")
        .select("summary_month, total_generation_kwh");

      const { data: ceb } = await supabase
        .from("ceb_data")
        .select("bill_date, units_exported");

      const merged = inv.map((i) => {
        const month = i.summary_month;
        const cebMonth = ceb.find((c) =>
          c.bill_date?.startsWith(month)
        );
        return {
          month,
          inverter: i.total_generation_kwh,
          ceb: cebMonth?.units_exported || 0,
        };
      });
      
      // Sort data by year and month in ascending order
      const sortedData = merged.sort((a, b) => {
        const [yearA, monthA] = a.month.split('-').map(Number);
        const [yearB, monthB] = b.month.split('-').map(Number);
        
        if (yearA !== yearB) {
          return yearA - yearB;
        }
        return monthA - monthB;
      });
      
      setData(sortedData);
    }
    load();
  }, []);

  return (
    <div className="chart-container" style={chartBox}>
      <div style={chartHeader}>
        <h2 style={{ margin: 0 }}>
          {view === "monthly" ? "Monthly Energy Summary" : "Yearly Overview"}
        </h2>
      </div>

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

export default EnergyCharts;
