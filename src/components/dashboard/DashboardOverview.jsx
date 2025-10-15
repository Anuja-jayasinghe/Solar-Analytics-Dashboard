import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const DashboardOverview = () => {
  const [summary, setSummary] = useState({
    ceb_units: 0,
    ceb_earnings: 0,
    inverter_gen: 0,
    inverter_earnings: 0,
  });

  useEffect(() => {
    async function fetchSummary() {
      const { data: ceb, error: e1 } = await supabase
        .from("ceb_data")
        .select("units_exported, earnings")
        .order("bill_date", { ascending: false })
        .limit(1);

      const { data: inv, error: e2 } = await supabase
        .from("inverter_data_daily_summary")
        .select("total_generation_kwh")
        .order("summary_date", { ascending: false })
        .limit(1);

      const units = ceb?.[0]?.units_exported || 0;
      const cebEarn = ceb?.[0]?.earnings || 0;
      const invGen = inv?.[0]?.total_generation_kwh || 0;
      const invEarn = invGen * 50; // rough rate; can link to settings

      setSummary({
        ceb_units: units,
        ceb_earnings: cebEarn,
        inverter_gen: invGen,
        inverter_earnings: invEarn,
      });
    }

    fetchSummary();
  }, []);

  return (
    <div style={cardsRow}>
      {[
        { label: "CEB Units", value: summary.ceb_units },
        { label: "CEB Earnings (LKR)", value: summary.ceb_earnings },
        { label: "Inverter Generation (kWh)", value: summary.inverter_gen },
        { label: "Est. Earnings (LKR)", value: summary.inverter_earnings },
      ].map((c, i) => (
        <div key={i} style={card}>
          <h3>{c.label}</h3>
          <p>{Math.round(c.value).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
};

const cardsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
  marginBottom: "2rem",
};
const card = {
  background: "rgba(20,20,20,0.7)",
  borderRadius: "10px",
  padding: "1rem",
  textAlign: "center",
  boxShadow: "0 0 10px rgba(255,122,0,0.2)",
};

export default DashboardOverview;
