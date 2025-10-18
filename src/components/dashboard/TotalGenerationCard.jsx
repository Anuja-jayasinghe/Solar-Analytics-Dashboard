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
        background: "var(--card-bg-solid)",
        border: "1px solid var(--card-border)",
        boxShadow: "0 8px 28px var(--card-shadow), inset 0 1px 1px var(--glass-border)",
      }}
    >
      <h3 style={{ ...labelStyle, color: "var(--accent)" }}>⚡ Total Lifetime Generation</h3>
      <p style={{ ...valueStyle, color: "var(--accent)" }}>{loading ? "..." : `${displayValue} ${unit}`}</p>
    </div>
  );
};

// 🎨 Styles
const cardStyle = {
  flex: 1,
  padding: "1.2rem",
  borderRadius: "14px",
  color: "#fff",
  backdropFilter: "blur(12px)",
  textAlign: "center",
  transition: "transform 0.3s ease, boxShadow 0.3s ease",
};

const labelStyle = { fontSize: "0.9rem", opacity: 0.95, marginBottom: "0.5rem" };

const valueStyle = { fontSize: "1.6rem", fontWeight: "800" };

export default TotalGenerationCard;
