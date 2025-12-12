import React, { useState } from "react";
import { useNavigate, useContext } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import CebDataManagement from "../components/admin/CebDataManagement"; 
import AdminManagement from "../components/admin/AdminManagement";
import UserAccessManagement from "../components/admin/UserAccessManagement";

function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const renderContent = () => {
    switch (tab) {
      case "ceb":
        return <CebDataManagement />;
      case "admins":
        return <AdminManagement />;
      case "users":
        return <UserAccessManagement />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: "users", label: "👥 User Access", desc: "Manage dashboard access levels" },
    { id: "admins", label: "🔐 Admin Roles", desc: "Promote/demote admin users" },
    { id: "ceb", label: "📊 CEB Data", desc: "Manage CEB data entry" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(30,30,30,0.95) 100%)",
        color: "var(--text-color)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "2rem",
          borderBottom: "1px solid var(--border-color)",
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(10px)"
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h1 style={{ color: "var(--accent)", margin: 0, fontSize: "32px", fontWeight: "bold" }}>
                ⚡ Admin Dashboard
              </h1>
              <p style={{ color: "var(--text-secondary)", margin: "0.5rem 0 0 0", fontSize: "14px" }}>
                Manage users, roles, and system settings
              </p>
            </div>
            
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "var(--accent)",
                color: "#000",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(255, 122, 0, 0.3)"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#ff8c00";
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 4px 12px rgba(255, 122, 0, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "var(--accent)";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 2px 8px rgba(255, 122, 0, 0.3)";
              }}
            >
              🏠 Back to Dashboard
            </button>
          </div>

          {/* Admin Info */}
          <div style={{
            padding: "1rem",
            background: "rgba(40, 167, 69, 0.1)",
            border: "1px solid rgba(40, 167, 69, 0.3)",
            borderRadius: "8px",
            fontSize: "14px",
            color: "var(--text-secondary)"
          }}>
            <span style={{ color: "#28a745", fontWeight: "bold" }}>👤 Logged in as:</span> {user?.email}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        {/* Tab Navigation */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem"
          }}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                background: tab === item.id ? "var(--accent)" : "rgba(50,50,50,0.6)",
                color: tab === item.id ? "#000" : "#fff",
                border: "1px solid " + (tab === item.id ? "var(--accent)" : "var(--border-color)"),
                padding: "1.5rem",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: tab === item.id
                  ? "0 0 15px rgba(255,122,0,0.6)"
                  : "0 0 5px rgba(0,0,0,0.2)",
                textAlign: "left"
              }}
              onMouseOver={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.background = "rgba(70,70,70,0.8)";
                  e.currentTarget.style.boxShadow = "0 0 10px rgba(255,122,0,0.3)";
                }
              }}
              onMouseOut={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.background = "rgba(50,50,50,0.6)";
                  e.currentTarget.style.boxShadow = "0 0 5px rgba(0,0,0,0.2)";
                }
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "0.5rem" }}>{item.label}</div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div
          style={{
            background: "rgba(20,20,20,0.5)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            backdropFilter: "blur(10px)",
            padding: "2rem"
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
