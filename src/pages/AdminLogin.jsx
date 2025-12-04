import React, { useEffect, useContext } from "react";
import { SignIn, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { isAdmin, session, loading, dashboardAccess, signOut } = useContext(AuthContext);
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  useEffect(() => {
    // Auto-redirect based on user role and access level
    if (!loading && session?.user) {
      console.log('🔐 AdminLogin Debug:', {
        isAdmin,
        dashboardAccess,
        email: session.user.email,
        metadata: clerkUser?.publicMetadata
      });
      
      if (isAdmin) {
        // Admin users go to admin dashboard
        console.log('✅ Redirecting to /admin/dashboard (Admin access)');
        navigate("/admin/dashboard");
      } else {
        // All regular users go to access page (can request or access dashboard from there)
        console.log('✅ Redirecting to /access (User access page)');
        navigate("/access");
      }
    }
  }, [session, isAdmin, dashboardAccess, loading, navigate, clerkUser]);

  // Show account management options if already logged in (regardless of admin status)
  if (clerkLoaded && clerkUser && !loading) {
    return (
      <div style={{ padding: 20, maxWidth: 500, margin: '2rem auto' }}>
        <div style={{ 
          padding: '1.5rem', 
          background: 'var(--card-bg)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>👋</div>
          <h2 style={{ margin: '0 0 1rem 0', color: "var(--text-primary)" }}>Already Logged In</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            <strong>Logged in as:</strong> {clerkUser.primaryEmailAddress?.emailAddress}
          </p>
          <p style={{ margin: '0.5rem 0', color: "var(--text-secondary)" }}>
            {isAdmin ? '🔑 Admin Account' : '👤 User Account'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            style={{ 
              background: "var(--accent)", 
              color: "#fff", 
              padding: "12px 24px", 
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            🚪 Logout
          </button>
          <button
            onClick={async () => {
              await signOut();
              window.location.reload(); // Force page reload to show login form
            }}
            style={{ 
              background: "var(--card-bg)", 
              color: "var(--text-primary)", 
              padding: "12px 24px", 
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            🔄 Switch Account
          </button>
          <button
            onClick={() => navigate('/')}
            style={{ 
              background: "transparent", 
              color: "var(--text-secondary)", 
              padding: "12px 24px", 
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            ← Back to Home
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
