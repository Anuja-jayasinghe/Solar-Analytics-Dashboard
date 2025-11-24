import React from "react";
import { useData } from "../../hooks/useData"; // Corrected import path

const TotalEarningsCard = () => {
  // 1. Get all the correct data from the context
  const { totalEarningsData, loading, errors, refreshData, lastUpdate } = useData();

  // 2. Use the correct keys for loading and errors
  const totalEarnings = totalEarningsData?.total || 0;
  const isLoading = loading.totalEarnings; // Corrected from 'totalEar'
  const hasError = errors.totalEarnings; // Corrected from 'totalEar'
  
  // 3. Calculate staleness (earnings derived from monthly data, 15min refresh)
  const isStale = lastUpdate.totalEarnings && (Date.now() - lastUpdate.totalEarnings) > 10 * 60 * 1000;

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
        💲 Total Earnings (CEB_Total)
        {isStale && <span style={staleBadge} title="Data is stale (>10 min old)">⏱️</span>}
        {hasError && ( // Corrected from 'errors.totalEar'
          <button 
            onClick={() => refreshData('totalEarnings')} // Corrected from 'totalEar'
            style={retryButton}
            title={`Error: ${typeof hasError === 'object' ? hasError.message : hasError}`}
          >
            ⚠️
          </button>
        )}
      </h3>
      <p style={{ ...valueStyle, color: "var(--accent)" }}>
        {/* 3. Correctly format the value as LKR (currency) */}
        {isLoading ? "..." : `LKR ${Math.round(totalEarnings).toLocaleString()}`}
      </p>
    </div>
  );
};

// 🎨 Styles (Unchanged, as requested)
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

const staleBadge = {
  marginLeft: "0.5rem",
  fontSize: "0.8rem",
  opacity: 0.7,
};

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

export default TotalEarningsCard;