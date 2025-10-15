import React, { useEffect, useState } from "react";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabaseClient";

const COLORS = ["#00c2a8", "#ff7a00"];

const EarningsBreakdown = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: ceb } = await supabase
        .from("ceb_data")
        .select("earnings");
      const { data: inv } = await supabase
        .from("inverter_data_daily_summary")
        .select("total_generation_kwh");

      const totalCEB = ceb.reduce((a, b) => a + (b.earnings || 0), 0);
      const totalInverter = inv.reduce(
        (a, b) => a + (b.total_generation_kwh || 0) * 50,
        0
      );
      setData([
        { name: "CEB Earnings", value: totalCEB },
        { name: "Inverter Value", value: totalInverter },
      ]);
    }
    load();
  }, []);

  return (
    <div style={chartBox}>
      <h2>Earnings Breakdown</h2>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name }) => name}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
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

export default EarningsBreakdown;
