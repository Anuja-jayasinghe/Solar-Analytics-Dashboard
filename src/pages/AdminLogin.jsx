import React, { useEffect, useContext } from "react";
import { SignIn, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { isAdmin, session, loading, dashboardAccess } = useContext(AuthContext);
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  useEffect(() => {
    // Auto-redirect based on user role and access level
    if (!loading && session?.user) {
      if (isAdmin) {
        // Admin users go to admin dashboard
        navigate("/admin/dashboard");
      } else if (dashboardAccess === 'real') {
        // Real dashboard access users
        navigate("/dashboard");
      } else {
        // Demo users - redirect to access request page
        navigate("/access");
      }
    }
  }, [session, isAdmin, dashboardAccess, loading, navigate]);

  // Show non-admin message if logged in but not admin
  if (clerkLoaded && clerkUser && !loading && !isAdmin) {
    return (
      <div style={{ padding: 20, maxWidth: 500, margin: '2rem auto' }}>
        <div style={{ 
          padding: '1.5rem', 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🚫</div>
          <h2 style={{ margin: '0 0 1rem 0', color: "#856404" }}>Access Denied</h2>
          <p style={{ margin: 0, color: "#856404" }}>
            <strong>Logged in as:</strong> {clerkUser.primaryEmailAddress?.emailAddress}
          </p>
          <p style={{ margin: '0.5rem 0', color: "#856404" }}>
            This account is not authorized as an admin.
          </p>
          <p style={{ margin: '1rem 0 0 0', color: "#856404", fontSize: '14px' }}>
            Contact the system administrator to request admin access.
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{ 
              background: "var(--accent)", 
              color: "#fff", 
              padding: "10px 24px", 
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading || !clerkLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--accent)'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px',
      background: 'var(--bg-color)'
    }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--accent)', fontSize: '2rem', margin: '0 0 0.5rem 0' }}>
          Admin Login
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Sign in with your admin account
        </p>
      </div>
      
      <SignIn 
        appearance={{
          elements: {
            rootBox: {
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              borderRadius: '12px'
            },
            card: {
              background: 'var(--card-bg)',
              boxShadow: 'none'
            }
          }
        }}
        routing="path"
        path="/admin"
        signUpUrl="/signup"
        afterSignInUrl="/admin"
        redirectUrl="/admin"
      />
    </div>
  );
}
