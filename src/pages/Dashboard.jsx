import { useState } from "react";
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

function Dashboard() {
  const [view, setView] = useState("monthly"); // default monthly

  // Datasets
  const dailyData = [
    { day: "Mon", ceb: 12, inverter: 14 },
    { day: "Tue", ceb: 18, inverter: 20 },
    { day: "Wed", ceb: 15, inverter: 16 },
    { day: "Thu", ceb: 22, inverter: 25 },
    { day: "Fri", ceb: 17, inverter: 18 },
    { day: "Sat", ceb: 25, inverter: 28 },
    { day: "Sun", ceb: 20, inverter: 23 },
  ];

  const monthlyData = [
    { month: "Jan", ceb: 450, inverter: 470 },
    { month: "Feb", ceb: 380, inverter: 400 },
    { month: "Mar", ceb: 500, inverter: 520 },
    { month: "Apr", ceb: 520, inverter: 540 },
    { month: "May", ceb: 600, inverter: 620 },
  ];

  const yearlyData = [
    { year: "2021", ceb: 5200, inverter: 5300 },
    { year: "2022", ceb: 6100, inverter: 6250 },
    { year: "2023", ceb: 6800, inverter: 6950 },
    { year: "2024", ceb: 7200, inverter: 7400 },
  ];

  // Pick dataset
  const chartData =
    view === "daily" ? dailyData : view === "monthly" ? monthlyData : yearlyData;

  // X axis key
  const xKey = view === "daily" ? "day" : view === "monthly" ? "month" : "year";

  return (
    <div>
      {/* Cards row */}
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

      {/* Chart container */}
      <div className="chart-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2>
            {view === "daily"
              ? "Daily Comparison (kWh)"
              : view === "monthly"
              ? "Monthly Comparison (kWh)"
              : "Yearly Comparison (kWh)"}
          </h2>

          {/* Toggle buttons */}
          <div>
            <button onClick={() => setView("daily")}>Daily</button>
            <button onClick={() => setView("monthly")}>Monthly</button>
            <button onClick={() => setView("yearly")}>Yearly</button>
          </div>
        </div>

        {/* Bar Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey={xKey} stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip />
            <Legend />
            <Bar dataKey="ceb" fill="#ff7a00" name="CEB Generation" />
            <Bar dataKey="inverter" fill="#00e0a1" name="Inverter Generation" />
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
              stroke="#00e0a1"
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
