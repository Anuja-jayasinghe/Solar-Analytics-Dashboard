import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import CebDataManagement from "../components/admin/CebDataManagement";
import UserManagement from "../components/admin/UserManagement";

function AdminDashboard() {
  const [tab, setTab] = useState(() => {
    return localStorage.getItem("admin_active_tab") || "users";
  });
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleTabChange = (id) => {
    setTab(id);
    localStorage.setItem("admin_active_tab", id);
  };

  const renderContent = () => {
    switch (tab) {
      case "ceb":
        return <CebDataManagement />;
      case "users":
        return <UserManagement />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: "users", label: "User Management" },
    { id: "ceb", label: "CEB Billing Data" },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto", color: "var(--text-color)" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "2rem"
      }}>
        <div>
          <h1 style={{ margin: "0 0 0.4rem 0", color: "var(--accent)", fontSize: "28px" }}>
            🛠️ Admin Dashboard
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px" }}>
            Manage users and billing data
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "transparent",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600"
            }}
          >
            ← Exit Admin
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {user?.email}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              border: tab === item.id ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              background: tab === item.id ? "var(--accent)" : "var(--card-bg)",
              color: tab === item.id ? "#fff" : "var(--text-color)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s ease"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "1.5rem",
        minHeight: "400px",
        boxShadow: "0 8px 32px var(--card-shadow)"
      }}>
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default AdminDashboard;
