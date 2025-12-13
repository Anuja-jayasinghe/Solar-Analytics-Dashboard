// src/components/MonthlyGenerationCard.jsx
import React, { useEffect, useState } from "react";
import NumberTicker from "../ui/NumberTicker";
import { useData } from "../../hooks/useData"; // Adjust path as needed


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
        {isLoading ? "..." : (<>
          <NumberTicker value={displayValue} format={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 3 })} /> {unit}
        </>)}
      </p>
      {formattedStartDate && (
        <p style={startDateOnlyStyle}>Start: {formattedStartDate}</p>
      )}
    </div>
  );
};

const cardStyle = {
  flex: 1,
  padding: "clamp(0.75rem, 2vw, 1.2rem)",
  borderRadius: "clamp(10px, 2vw, 14px)",
  color: "#fff",
  backdropFilter: "blur(12px)",
  textAlign: "center",
  transition: "transform 0.3s ease, boxShadow 0.3s ease",
  minWidth: "min(100%, 200px)",
};

const labelStyle = { 
  fontSize: "clamp(0.8rem, 2vw, 0.9rem)", 
  opacity: 0.95, 
  marginBottom: "0.5rem",
  lineHeight: 1.3
};
const valueStyle = { 
  fontSize: "clamp(1.3rem, 4vw, 1.6rem)", 
  fontWeight: "800",
  wordBreak: "break-word"
};

const startDateOnlyStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginTop: '0.25rem',
};

export default MonthlyGenerationCard;
