import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const SystemTrends = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("inverter_data_daily_summary")
        .select("summary_date, total_generation_kwh, peak_power_kw")
        .order("summary_date", { ascending: false })
        .limit(10);
      setRows(data);
    }
    load();
  }, []);

  return (
    <div style={box}>
      <h2>Recent Generation Trends</h2>
      <table style={table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Total (kWh)</th>
            <th>Peak (kW)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.summary_date}>
              <td>{r.summary_date}</td>
              <td>{r.total_generation_kwh}</td>
              <td>{r.peak_power_kw || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const box = {
  background: "rgba(15,15,15,0.6)",
  borderRadius: "10px",
  padding: "1.5rem",
  boxShadow: "0 0 20px rgba(0,0,0,0.3)",
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  color: "#fff",
};
export default SystemTrends;
