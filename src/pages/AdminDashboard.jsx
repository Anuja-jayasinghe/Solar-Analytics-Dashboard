import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../components/ThemeContext";
import { AuthContext } from "../contexts/AuthContext";
import Dashboard from "./Dashboard";

function AdminDashboard() {
  const { session, user, isAdmin, loading, signOut } = useContext(AuthContext);
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    console.log("AdminDashboard - loading:", loading, "user:", user, "isAdmin:", isAdmin);
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log("Loading timeout reached, forcing redirect to login");
        navigate("/admin");
      }
    }, 10000); // 10 second timeout

    // If not loading and no user, redirect to login
    if (!loading && !user) {
      console.log("No user found, redirecting to login");
      navigate("/admin");
      return;
    }

    // If not loading and user exists but not admin, redirect to login
    if (!loading && user && !isAdmin) {
      console.log("User is not an admin, redirecting to login");
      navigate("/admin");
      return;
    }

    return () => clearTimeout(timeout);
  }, [loading, user, isAdmin, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/admin");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Show loading while checking authentication (with timeout)
  if (loading && !user) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-header">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // If we have a user but still loading admin check, show dashboard anyway
  if (loading && user) {
    console.log("User exists but still loading admin check, showing dashboard");
  }

  // If no user, don't render anything (redirect will happen)
  if (!user) {
    return null;
  }

  console.log("AdminDashboard rendering - user:", user, "isAdmin:", isAdmin, "loading:", loading);
  
  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-header">
        <div className="admin-header-content">
          <div className="admin-title">
            <h1>⚡ Solar Analytics Admin</h1>
            <p>Welcome back, {user.email}</p>
            <p style={{fontSize: '12px', opacity: 0.7}}>Loading: {loading ? 'Yes' : 'No'}, Admin: {isAdmin ? 'Yes' : 'No'}</p>
          </div>
          <div className="admin-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              onClick={handleLogout}
              className="logout-btn"
              style={{
                background: '#ff7a00',
                color: '#fff',
                border: '2px solid #ff7a00',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                minWidth: '120px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-content">
        <div className="admin-dashboard-main">
          <Dashboard />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
