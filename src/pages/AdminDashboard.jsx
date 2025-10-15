import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CebDataManagement from "../components/CebDataManagement"; // ✅ new modular component
// (Later you'll add:)
 // import InverterDataManagement from "../components/InverterDataManagement";
 // import AdminManagement from "../components/AdminManagement";

function AdminDashboard() {
  const [tab, setTab] = useState("ceb");
  const navigate = useNavigate();

  const renderContent = () => {
    switch (tab) {
      case "ceb":
        return <CebDataManagement />;
      case "admins":
        return (
          <div style={contentStyle}>
            <h2 style={{ color: "var(--accent)" }}>🧑‍💼 Admin Management</h2>
            <p style={{ color: "#aaa" }}>
              Manage authorized admin accounts here — add, remove, and view admin users.
            </p>
            <p>⚙️ Coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        color: "var(--text-color)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "var(--accent)", margin: 0 }}>⚡ Admin Dashboard</h1>
        
        <button
          onClick={() => navigate("/")}
          style={{
            background: "var(--accent)",
            color: "#000",
            border: "none",
            padding: "10px 20px",
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
          🏠 Return to Dashboard
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          background: "rgba(20,20,20,0.5)",
          padding: "0.8rem 1rem",
          borderRadius: "10px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        {[
          { id: "ceb", label: "CEB Data" },
          { id: "admins", label: "Admin Management" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              background: tab === item.id ? "var(--accent)" : "rgba(50,50,50,0.6)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow:
                tab === item.id
                  ? "0 0 10px rgba(255,122,0,0.6)"
                  : "0 0 5px rgba(0,0,0,0.2)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          background: "rgba(15,15,15,0.7)",
          borderRadius: "12px",
          padding: "1rem 1.5rem",
          backdropFilter: "blur(10px)",
          boxShadow: "0 0 20px rgba(255,122,0,0.05)",
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}

const contentStyle = {
  padding: "1rem",
  background: "rgba(30,30,30,0.6)",
  borderRadius: "10px",
  backdropFilter: "blur(10px)",
  color: "#fff",
  textAlign: "center",
};

export default AdminDashboard;