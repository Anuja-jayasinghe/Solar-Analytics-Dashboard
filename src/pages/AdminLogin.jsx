import React, { useEffect, useState, useContext } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function AdminLogin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin, session } = useContext(AuthContext);

  useEffect(() => {
    // Use the session and isAdmin from AuthContext instead of managing our own state
    if (session?.user) {
      setUser(session.user);
      // Only auto-redirect if user is admin, otherwise let them see the login page
      if (isAdmin) {
        navigate("/admin/dashboard");
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [session, isAdmin, navigate]);

  async function signInWithGoogle() {
    const origin = window.location.origin;
    console.log('🔐 Admin Login: Attempting Google OAuth with redirect:', `${origin}/admin/dashboard`);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: `${origin}/admin/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      },
    });
    
    if (error) {
      console.error('❌ OAuth Error:', error);
      alert(`Login failed: ${error.message}`);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '2rem auto' }}>
      <h2>Admin Login</h2>
      {user && !isAdmin ? (
        <div style={{ 
          padding: '1rem', 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0, color: "#856404" }}>
            <strong>Logged in as:</strong> {user.email}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', color: "#856404" }}>
            This account is not authorized as an admin.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ 
                background: "#dc3545", 
                color: "#fff", 
                padding: "8px 16px", 
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              🚪 Sign Out
            </button>
            <button
              onClick={() => {
                supabase.auth.signOut();
                // Small delay to ensure sign out completes
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }}
              style={{ 
                background: "#007bff", 
                color: "#fff", 
                padding: "8px 16px", 
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              🔄 Try Different Account
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={signInWithGoogle}
            style={{ 
              background: "#ff7a00", 
              color: "#fff", 
              padding: "10px 20px", 
              border: "none", 
              borderRadius: "4px", 
              cursor: "pointer",
              marginBottom: "1rem",
              width: "100%"
            }}
          >
            Sign in with Google
          </button>
          {user && (
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ 
                background: "#6c757d", 
                color: "#fff", 
                padding: "8px 16px", 
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                width: "100%"
              }}
            >
              🚪 Sign Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
