// src/components/TotalGenerationCard.jsx
import React from "react";
import { useData } from "../../hooks/useData"; // Adjust path as needed

const TotalGenerationCard = () => {
  // --- UPDATED LOGIC ---
  // 1. Get the correct data, loading, and error states from the context
  const { livePowerData, loading, errors, refreshData, lastUpdate } = useData();

  // 2. Extract the data from the 'livePowerData' object
  const total = livePowerData?.totalGeneration?.value || 0;
  const unit = livePowerData?.totalGeneration?.unit || "kWh";
  const isLoading = loading.live;
  const hasError = errors.live;
  
  // 3. Calculate staleness (live data should refresh every 5 minutes)
  const isStale = lastUpdate.live && (Date.now() - lastUpdate.live) > 10 * 60 * 1000;

  // 3. Format the value for display
  const formattedValue = total.toLocaleString(undefined, {
    maximumFractionDigits: 1, // Show one decimal
  });
  // --- END UPDATED LOGIC ---

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
        {/* 4. Update title and error handling keys */}
        ⚡ All-Time Generation
        {isStale && <span style={staleBadge} title="Data is stale (>10 min old)">⏱️</span>}
        {hasError && (
          <button 
            onClick={() => refreshData('live')} // Refresh 'live' data
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

// --- STYLES (Unchanged, as requested) ---
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

export default TotalGenerationCard;