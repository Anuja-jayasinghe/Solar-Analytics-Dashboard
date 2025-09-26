import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

import { getMonthlyData, getYearlyData } from "../lib/dataService";

function Dashboard() {
  const [view, setView] = useState("monthly"); // default monthly
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [m, y] = await Promise.all([
          getMonthlyData(),
          getYearlyData(),
        ]);
        if (!isMounted) return;
        setMonthlyData(m);
        setYearlyData(y);
      } catch (e) {
        if (!isMounted) return;
        setError(e.message || "Failed to load data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const chartData = view === "monthly" ? monthlyData : yearlyData;
  const xKey = view === "monthly" ? "month" : "year";

  return (
    <div>
      {/* Cards Row */}
      <div className="cards-row">
        <div className="card">
          <h3>CEB Units</h3>
          <p>150</p>
        </div>
        <div className="card">
          <h3>CEB Earnings (LKR)</h3>
          <p>5,550</p>
        </div>
        <div className="card">
          <h3>Inverter Generation</h3>
          <p>160 kWh</p>
        </div>
        <div className="card">
          <h3>Estimated Earnings</h3>
          <p>5,920 LKR</p>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="chart-container">
          <h2>Loading data…</h2>
        </div>
      )}
      {!loading && error && (
        <div className="chart-container">
          <h2 style={{ color: "#ff7a00" }}>Error: {error}</h2>
        </div>
      )}

      {/* Chart Container - Bar Chart */}
      <div className="chart-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2>
            {view === "monthly"
              ? "Monthly Comparison (kWh)"
              : "Yearly Comparison (kWh)"}
          </h2>

          {/* Toggle Buttons */}
          <div>
            <button
              onClick={() => setView("monthly")}
              style={{
                marginRight: "0.5rem",
                background: view === "monthly" ? "#ff7a00" : "#333",
                color: "#fff",
                padding: "0.3rem 0.8rem",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setView("yearly")}
              style={{
                background: view === "yearly" ? "#00c2a8" : "#333",
                color: "#fff",
                padding: "0.3rem 0.8rem",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Yearly
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey={xKey} stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip />
            <Legend />
            <Bar dataKey="ceb" fill="#ff7a00" name="CEB Generation" />
            <Bar dataKey="inverter" fill="#00c2a8" name="Inverter Generation" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart */}
      <div className="chart-container" style={{ marginTop: "2rem" }}>
        <h2>Trend Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey={xKey} stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="ceb"
              stroke="#ff7a00"
              strokeWidth={2}
              name="CEB Generation"
            />
            <Line
              type="monotone"
              dataKey="inverter"
              stroke="#00c2a8"
              strokeWidth={2}
              name="Inverter Generation"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Dashboard;
