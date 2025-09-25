import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

function Dashboard() {
  // Dummy data for now
  const data = [
    { day: "Mon", generation: 12 },
    { day: "Tue", generation: 18 },
    { day: "Wed", generation: 15 },
    { day: "Thu", generation: 22 },
    { day: "Fri", generation: 17 },
    { day: "Sat", generation: 25 },
    { day: "Sun", generation: 20 },
  ];

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
        <h2>Daily Generation (kWh)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="day" stroke="var(--text-color)" />
            <YAxis stroke="var(--text-color)" />
            <Tooltip />
            <Bar dataKey="generation" fill="var(--accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Dashboard;
