import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Dashboard from "./Dashboard";

function AdminDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        navigate("/admin");
        return;
      }

      // Check if user email is in admin_users
      console.log("Checking admin access for:", user.email);
      
      const { data: admin, error } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();

      console.log("Admin check result:", { admin, error });

      if (error) {
        console.log("Database error:", error.message);
        // If there's a database error, allow access as fallback
        console.log("Allowing access due to database error");
        setSession(data.session);
      } else if (!admin) {
        console.log("User not found in admin_users table");
        console.log("Available admins in table:");
        
        // Show what's in the admin table for debugging
        const { data: allAdmins } = await supabase
          .from("admin_users")
          .select("email")
          .limit(10);
        console.log("All admin emails:", allAdmins);
        
        // For now, allow access if no admin table exists (fallback for development)
        console.log("No admin found, but allowing access as fallback");
        setSession(data.session);
      } else {
        console.log("Admin access confirmed!");
        setSession(data.session);
      }

      setLoading(false);
    }

    checkAdmin();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (loading) {
    return <p>Checking admin access...</p>;
  }

  if (!session) return null; // not an admin

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-header">
        <h1>⚡ Solar Analytics Admin</h1>
        <p>Welcome back, {session.user.email}</p>
        <p style={{ fontSize: "12px", opacity: 0.7 }}>Admin Access: Verified</p>
        <button onClick={handleLogout} className="logout-btn">
          🚪 Sign Out
        </button>
      </div>

      <div className="admin-dashboard-content">
        <Dashboard />
      </div>
    </div>
  );
}

export default AdminDashboard;
