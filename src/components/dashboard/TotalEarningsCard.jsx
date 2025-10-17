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
        background: "linear-gradient(135deg, #1a1a1a, #332800)",
      }}
    >
      <h3 style={labelStyle}>💰 Total Earnings (CEB)</h3>
      <p style={valueStyle}>{loading ? "..." : `LKR ${total.toLocaleString()}`}</p>
    </div>
  );
};

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
  

export default TotalEarningsCard;
