import React, { useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import AdminBottomNav from "../components/admin/AdminBottomNav";
import "../styles/admin.css";

const tabs = [
  { path: "users", label: "User Management" },
  { path: "ceb-billing", label: "CEB Billing Data" },
];

function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-header-title">🛠️ Admin Dashboard</h1>
          <p className="admin-header-subtitle">Manage users and billing data</p>
        </div>

        <div className="admin-header-actions">
          <button className="admin-exit-btn" onClick={() => navigate("/dashboard")} title="Exit Admin">
            ← <span className="admin-exit-btn-label">Exit Admin</span>
          </button>
          <span className="admin-header-email">{user?.email}</span>
        </div>
      </div>

      <div className="admin-tab-nav">
        {tabs.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `admin-tab-button${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="admin-content-card">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>

      <AdminBottomNav />
    </div>
  );
}

export default AdminDashboard;
