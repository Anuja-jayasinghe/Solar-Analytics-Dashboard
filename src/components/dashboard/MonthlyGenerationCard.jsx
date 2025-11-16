// src/components/MonthlyGenerationCard.jsx
import React, { useEffect, useState } from "react";
import { useData } from "../../hooks/useData"; // Adjust path as needed
import { supabase } from "../../lib/supabaseClient";

const MonthlyGenerationCard = () => {
  const { monthlyGenerationData, loading } = useData();

  // Extract data from context
  const total = monthlyGenerationData?.total || 0;
  const startDate = monthlyGenerationData?.startDate;
  const isLoading = loading.monthlyGen;

  // Format start date short (DD Mon)
  const formattedStartDate = startDate
    ? new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : null;
  
  // Convert only if >= 1000 kWh — keep exact precision
  let displayValue = total;
  let unit = "kWh";

  if (total >= 1000) {
    displayValue = total / 1000; // convert to MWh
    unit = "MWh";
  }

  // Optional: format with commas for readability
  const formattedValue = displayValue.toLocaleString(undefined, {
    maximumFractionDigits: 3, // show up to 3 decimals but don't force rounding
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
      <h3 style={{ ...labelStyle, color: "var(--accent)", textAlign: 'center' }}>
        Monthly Generation Total
      </h3>
      <p style={{ ...valueStyle, color: "var(--accent)" }}>
        {isLoading ? "..." : `${formattedValue} ${unit}`}
      </p>
      {formattedStartDate && (
        <p style={startDateOnlyStyle}>Start: {formattedStartDate}</p>
      )}
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

const startDateOnlyStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginTop: '0.25rem',
};

export default MonthlyGenerationCard;
