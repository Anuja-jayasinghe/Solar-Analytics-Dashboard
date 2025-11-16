// src/components/MonthlyGenerationCard.jsx
import React, { useEffect, useState } from "react";
import { useData } from "../../hooks/useData"; // Adjust path as needed
import { supabase } from "../../lib/supabaseClient";

const MonthlyGenerationCard = () => {
  const { monthlyGenerationData, loading, errors, refreshData } = useData();

  // Extract data from context
  const total = monthlyGenerationData?.total || 0;
  const isLoading = loading.monthlyGen;

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
        background: "var(--card-bg-solid)",
        border: "1px solid var(--card-border)",
        boxShadow: "0 8px 28px var(--card-shadow), inset 0 1px 1px var(--glass-border)",
      }}
    >
      <h3 style={{ ...labelStyle, color: "var(--accent)" }}>
        📆 This Month's Generation
        {errors.monthlyGen && (
          <button 
            onClick={() => refreshData('monthlyGen')} 
            style={retryButton}
            title="Retry loading data"
          >
            ⚠️
          </button>
        )}
      </h3>
      <p style={{ ...valueStyle, color: "var(--accent)" }}>
        {isLoading ? "..." : `${formattedValue} ${unit}`}
      </p>
    </div>
  );
};

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

const retryButton = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  borderRadius: "4px",
  padding: "0.2rem 0.4rem",
  fontSize: "0.7rem",
  cursor: "pointer",
  marginLeft: "0.5rem",
  transition: "all 0.2s ease",
};

export default MonthlyGenerationCard;
