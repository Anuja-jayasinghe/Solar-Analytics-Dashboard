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
    <div style={chartBox}>
      <div style={chartHeader}>
        <h2 style={{ margin: 0 }}>
          {view === "monthly" ? "Monthly Energy Summary" : "Yearly Overview"}
        </h2>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="month" stroke="#aaa" />
          <YAxis stroke="#aaa" />
          <Tooltip />
          <Legend />
          <Bar dataKey="inverter" fill="#00c2a8" name="Inverter (kWh)" />
          <Bar dataKey="ceb" fill="#ff7a00" name="CEB (kWh)" />
        </BarChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={250} style={{ marginTop: "2rem" }}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="month" stroke="#aaa" />
          <YAxis stroke="#aaa" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="inverter" stroke="#00c2a8" />
          <Line type="monotone" dataKey="ceb" stroke="#ff7a00" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const chartBox = {
  background: "rgba(15,15,15,0.6)",
  borderRadius: "10px",
  padding: "1.5rem",
  boxShadow: "0 0 20px rgba(0,0,0,0.3)",
};
const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
};

export default EnergyCharts;
