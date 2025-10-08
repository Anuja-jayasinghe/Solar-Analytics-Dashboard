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

  // Calculate latest month's summary for cards
  const latestMonth = monthlyData[monthlyData.length - 1] || {};
  const cebUnits = latestMonth.ceb || 0;
  const cebEarnings = (latestMonth.cebEarnings ?? (cebUnits * 50));
  const inverterGen = latestMonth.inverter || 0;
  const inverterEarnings = (latestMonth.inverterEarnings ?? (inverterGen * 50));


  return (
    <div>
      {/* Cards Row */}
      <div className="cards-row">
        <div className="card">
          <h3>CEB Units</h3>
          <p>{cebUnits}</p>
        </div>
        <div className="card">
          <h3>CEB Earnings (LKR)</h3>
          <p>{Math.round(cebEarnings).toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Inverter Generation</h3>
          <p>{inverterGen} kWh</p>
        </div>
        <div className="card">
          <h3>Estimated Earnings</h3>
          <p>{Math.round(inverterEarnings).toLocaleString()} LKR</p>
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
          <div className="chart-toggle">
            <button
              onClick={() => setView("monthly")}
              className={view === "monthly" ? "active" : ""}
            >
              Monthly
            </button>
            <button
              onClick={() => setView("yearly")}
              className={view === "yearly" ? "active" : ""}
            >
              Yearly
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--text-color)" opacity={0.3} />
            <XAxis dataKey={xKey} stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--sidebar-bg)',
                border: '1px solid var(--text-color)',
                color: 'var(--text-color)'
              }}
            />
            <Legend />
            <Bar dataKey="ceb" fill="var(--accent)" name="CEB Generation" />
            <Bar dataKey="inverter" fill="var(--accent-secondary)" name="Inverter Generation" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart */}
      <div className="chart-container" style={{ marginTop: "2rem" }}>
        <h2>Trend Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--text-color)" opacity={0.3} />
            <XAxis dataKey={xKey} stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--sidebar-bg)',
                border: '1px solid var(--text-color)',
                color: 'var(--text-color)'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ceb"
              stroke="var(--accent)"
              strokeWidth={2}
              name="CEB Generation"
            />
            <Line
              type="monotone"
              dataKey="inverter"
              stroke="var(--accent-secondary)"
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
