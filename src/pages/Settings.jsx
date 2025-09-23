import { useState } from "react";

function Settings() {
  const [currency, setCurrency] = useState("LKR");
  const [unitType, setUnitType] = useState("kWh");
  const [rate, setRate] = useState(37);
  const [theme, setTheme] = useState("dark");

  return (
    <div>
      <h2>Settings</h2>

      <div className="settings-group">
        <label>Currency</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="LKR">LKR</option>
          <option value="USD">USD</option>
          <option value="AED">AED</option>
        </select>
      </div>

      <div className="settings-group">
        <label>Energy Unit</label>
        <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
          <option value="kWh">kWh</option>
          <option value="Units">Units</option>
        </select>
      </div>

      <div className="settings-group">
        <label>Default Rate</label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </div>

      <div className="settings-group">
        <label>Theme</label>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    </div>
  );
}

export default Settings;
