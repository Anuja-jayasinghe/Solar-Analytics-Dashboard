// src/components/MonthlyGenerationCard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const MonthlyGenerationCard = () => {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMonthly = async () => {
      setLoading(true);
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-01`;

      const { data, error } = await supabase
        .from("inverter_data_daily_summary")
        .select("total_generation_kwh")
        .gte("summary_date", startOfMonth);

      if (error) {
        console.error("⚠️ Error fetching monthly generation:", error);
      } else {
        const totalKwh = data.reduce(
          (sum, r) => sum + Number(r.total_generation_kwh || 0),
          0
        );
        setTotal(totalKwh);
      }
      setLoading(false);
    };

    fetchMonthly();
  }, []);

  // ✅ Convert only if >= 1000 kWh — keep exact precision
  let displayValue = total;
  let unit = "kWh";

  if (total >= 1000) {
    displayValue = total / 1000; // convert to MWh
    unit = "MWh";
  }

  // Optional: format with commas for readability
  const formattedValue = displayValue.toLocaleString(undefined, {
    maximumFractionDigits: 3, // show up to 3 decimals but don’t force rounding
  });

  return (
    <div
    style={{
      ...cardStyle,
      background: "linear-gradient(135deg, #1a1a1a, #332800)",
    }}
  >
      <h3 style={labelStyle}>📆 This Month’s Generation</h3>
      <p style={valueStyle}>{loading ? "..." : `${formattedValue} ${unit}`}</p>
    </div>
  );
};

const cardStyle = {
  flex: 1,
  padding: "1.2rem",
  borderRadius: "14px",
  color: "#fff",
  backdropFilter: "blur(10px)",
  boxShadow: "0 0 20px rgba(0,255,255,0.15)",
  textAlign: "center",
  border: "1px solid rgba(0,255,255,0.2)",
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
};

const labelStyle = { fontSize: "0.9rem", opacity: 0.8, marginBottom: "0.5rem" };
const valueStyle = { fontSize: "1.6rem", fontWeight: "bold", color: "#00e0ff" };

export default MonthlyGenerationCard;
