// src/components/TotalEarningsCard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const TotalEarningsCard = () => {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      const { data, error } = await supabase.from("ceb_data").select("earnings");

      if (error) console.error("⚠️ Error fetching earnings:", error);
      else {
        const totalEarn = data.reduce((sum, r) => sum + Number(r.earnings || 0), 0);
        setTotal(totalEarn);
      }
      setLoading(false);
    };

    fetchEarnings();
  }, []);

  return (
    <div
      style={{
        ...cardStyle,
        background: "linear-gradient(145deg, rgba(20,20,22,0.9), rgba(14,14,16,0.95))",
        border: "1px solid rgba(255,122,0,0.25)",
        boxShadow: "0 8px 28px rgba(255,122,0,0.12), inset 0 1px 1px rgba(255,255,255,0.06)",
      }}
    >
      <h3 style={{ ...labelStyle, color: "#ff7a00" }}>💰 Total Earnings (CEB)</h3>
      <p style={{ ...valueStyle, color: "#ff7a00" }}>{loading ? "..." : `LKR ${total.toLocaleString()}`}</p>
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
  

export default TotalEarningsCard;
