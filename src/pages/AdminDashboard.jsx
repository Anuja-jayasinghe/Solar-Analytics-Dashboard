import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import CebDataManagement from "../components/admin/CebDataManagement"; 
import UserManagement from "../components/admin/UserManagement";
import { adminShellStyles, adminTheme } from "../components/admin/adminTheme";

function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

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
    { id: "users", label: "USER_MGMT", desc: "roles, permissions, access" },
    { id: "ceb", label: "CEB_DATA", desc: "billing records, earnings, history" },
  ];

  return (
    <div
      style={{
        ...adminShellStyles.page,
      }}
    >
      {/* Header */}
      <div
        style={{
          ...adminShellStyles.header,
        }}
      >
        <div style={adminShellStyles.pageFrame}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <div style={adminShellStyles.badge}>
                admin / control-plane
              </div>
              <h1 style={{ ...adminShellStyles.pageTitle, marginTop: "0.8rem" }}>
                Admin Control Center
              </h1>
              <p style={{ color: adminTheme.colors.textMuted, margin: "0.5rem 0 0 0", fontSize: "14px" }}>
                Secure operations for users, access policy, and billing records
              </p>
            </div>
            
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                ...adminShellStyles.pillButton,
                background: adminTheme.gradients.accent,
                color: adminTheme.colors.text,
                padding: "12px 24px",
                fontSize: "14px",
                boxShadow: adminTheme.shadows.button,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = adminTheme.colors.accentDark;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = adminTheme.shadows.buttonHover;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = adminTheme.colors.accent;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = adminTheme.shadows.button;
              }}
            >
              return_to_dashboard
            </button>
          </div>

          {/* Admin Info */}
          <div style={{
            padding: "1rem",
            background: adminTheme.colors.accentSoft,
            border: `1px solid ${adminTheme.colors.border}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: adminTheme.colors.textMuted,
            fontFamily: adminTheme.fonts.mono,
          }}>
            <span style={{ color: adminTheme.colors.accent, fontWeight: "bold" }}>identity:</span> {user?.email}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ ...adminShellStyles.pageFrame, padding: "2rem" }}>
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
                ...adminShellStyles.tabCard,
                ...(tab === item.id ? adminShellStyles.tabCardActive : {}),
              }}
              onMouseOver={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.background = "rgba(59,130,246,0.12)";
                  e.currentTarget.style.boxShadow = "0 0 10px rgba(59,130,246,0.24)";
                }
              }}
              onMouseOut={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.background = "rgba(16, 30, 58, 0.72)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <div style={{ fontFamily: adminTheme.fonts.mono, fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", color: tab === item.id ? adminTheme.colors.text : adminTheme.colors.accent }}>
                {item.label}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.78, marginTop: "0.55rem" }}>{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div
          style={{
            ...adminShellStyles.panel,
            padding: "2rem"
          }}
        >
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
