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
    if (!loading && clerkLoaded && session?.user) {
      console.log('🔐 AdminLogin Debug:', {
        isAdmin,
        dashboardAccess,
        email: session.user.email,
        metadata: clerkUser?.publicMetadata
      });
      
      if (dashboardAccess === 'real') {
        // Real users and admins go to real dashboard
        console.log('✅ Redirecting to /dashboard (Real user or Admin)');
        navigate("/dashboard", { replace: true });
      } else {
        // Demo users go to demo dashboard
        console.log('✅ Redirecting to /demodashbaard (Demo user)');
        navigate("/demodashbaard", { replace: true });
      }
    }
  }, [session, isAdmin, dashboardAccess, loading, navigate, clerkUser, clerkLoaded]);

  // Show loading while redirecting if already logged in
  if (clerkLoaded && clerkUser && !loading && session) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--accent)'
      }}>
        Redirecting...
      </div>
    );
  }

  // Show account management options only if not authenticated yet (this shouldn't normally show)
  if (clerkLoaded && clerkUser && !loading && !session) {
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
          Login
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Sign in to access your dashboard
        </p>
      </div>
      
      <SignIn 
        appearance={{
          baseTheme: undefined,
          variables: {
            colorPrimary: '#ff7a00',
            colorText: 'var(--text-color)',
            colorTextSecondary: 'var(--text-secondary)',
            colorBackground: 'var(--card-bg-solid)',
            colorInputBackground: 'var(--bg-color)',
            colorInputText: 'var(--text-color)',
            borderRadius: '8px',
            fontFamily: 'Inter, sans-serif'
          },
          elements: {
            rootBox: {
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              borderRadius: '12px'
            },
            card: {
              background: 'var(--card-bg-solid)',
              boxShadow: 'none',
              border: '1px solid var(--card-border)',
              padding: '2rem'
            },
            headerTitle: {
              color: 'var(--text-color)',
              fontSize: '24px',
              fontWeight: '700'
            },
            headerSubtitle: {
              color: 'var(--text-secondary)'
            },
            formButtonPrimary: {
              background: '#ff7a00',
              color: '#000',
              fontWeight: '700',
              '&:hover': {
                background: '#ff8c00'
              }
            },
            formFieldInput: {
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-color)',
              '&:focus': {
                borderColor: '#ff7a00'
              }
            },
            formFieldLabel: {
              color: 'var(--text-color)',
              fontWeight: '500'
            },
            identityPreviewText: {
              color: 'var(--text-color)'
            },
            identityPreviewEditButton: {
              color: '#ff7a00'
            },
            footerActionText: {
              color: 'var(--text-secondary)'
            },
            footerActionLink: {
              color: '#ff7a00',
              fontWeight: '600',
              '&:hover': {
                color: '#ff8c00'
              }
            },
            socialButtonsBlockButton: {
              background: 'var(--card-bg-solid)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-color)',
              '&:hover': {
                background: 'var(--hover-bg)'
              }
            },
            dividerLine: {
              background: 'var(--border-color)'
            },
            dividerText: {
              color: 'var(--text-secondary)'
            },
            otpCodeFieldInput: {
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-color)'
            },
            formResendCodeLink: {
              color: '#ff7a00'
            }
          }
        }}
        routing="virtual"
        signUpUrl="/signup"
        afterSignInUrl="/"
        redirectUrl="/"
      />
    </div>
  );
}
