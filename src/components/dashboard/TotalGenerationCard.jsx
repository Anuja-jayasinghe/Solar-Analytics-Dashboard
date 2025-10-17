// src/components/TotalGenerationCard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const TotalGenerationCard = () => {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const { data, error } = await supabase
          .from("system_metrics")
          .select("metric_value")
          .eq("metric_name", "total_generation")
          .single(); // get single row

        if (error) {
          console.error("⚠️ Error fetching total generation:", error);
        } else {
          setTotal(Number(data.metric_value) || 0);
        }
      } catch (err) {
        console.error("⚠️ Unexpected error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTotal();
  }, []);

  // Automatically adjust units
  const displayValue = total >= 1000 ? (total / 1000).toFixed(2) : total.toFixed(2);
  const unit = "MWh";

  return (
    <div
      style={{
        ...cardStyle,
        background: "linear-gradient(135deg, #1a1a1a, #332800)",
      }}
    >
      <h3 style={labelStyle}>⚡ Total Lifetime Generation</h3>
      <p style={valueStyle}>{loading ? "..." : `${displayValue} ${unit}`}</p>
    </div>
  );
};

// 🎨 Styles
const cardStyle = {
  flex: 1,
  padding: "1.2rem",
  borderRadius: "14px",
  color: "#fff",
  backdropFilter: "blur(10px)",
  boxShadow: "0 0 20px rgba(255,215,0,0.15)",
  textAlign: "center",
  border: "1px solid rgba(255,215,0,0.2)",
  transition: "transform 0.3s ease, boxShadow 0.3s ease",
};

const labelStyle = {
  fontSize: "0.9rem",
  opacity: 0.8,
  marginBottom: "0.5rem",
};

const valueStyle = {
  fontSize: "1.6rem",
  fontWeight: "bold",
  color: "#ffd700",
};

export default TotalGenerationCard;
