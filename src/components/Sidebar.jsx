import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div className="sidebar">
      <h2 className="logo">⚡ SolarDash</h2>
      <nav>
        <ul>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/settings">Settings</Link></li>
        </ul>
      </nav>
    </div>
  );
}

export default Sidebar;
