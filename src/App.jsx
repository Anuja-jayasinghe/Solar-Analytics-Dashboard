// App.js
import React, { useState, useEffect, useContext, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import ToastManager from './components/shared/ToastManager';
import { ThemeProvider } from "./components/ThemeContext";
import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import Sidebar from "./components/Sidebar";
import GoToTopButton from "./components/GoToTopButton";
import DevToolsPanel from "./components/DevToolsPanel";
import "./index.css";
import { verifySupabaseConnection } from "./lib/verifySupabaseConnection";
import { Analytics } from "@vercel/analytics/react"
import MaintenancePage from "./pages/MaintenancePage";
import ErrorBoundary from "./components/ErrorBoundary";

// Clerk configuration
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const USE_CLERK_AUTH = import.meta.env.VITE_USE_CLERK_AUTH === 'true';

// Lazy load pages for better code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Landing = lazy(() => import("./pages/Landing"));
// Demo/Real separated pages
const DashboardDemo = lazy(() => import("./pages/demo/DashboardDemo"));
const SettingsDemo = lazy(() => import("./pages/demo/SettingsDemo"));
const DashboardReal = lazy(() => import("./pages/real/DashboardReal"));
const SettingsReal = lazy(() => import("./pages/real/SettingsReal"));
const AccessRequest = lazy(() => import("./pages/AccessRequest"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Signup = lazy(() => import("./pages/Signup"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

import BottomNav from "./components/BottomNav";

function AppContent() {
  const { isAdmin, loading, session } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const devtoolsEnabled = (import.meta?.env?.VITE_ENABLE_DEVTOOLS ?? 'true') === 'true';

  useEffect(() => {
    // Verify Supabase connection - don't block app if it fails
    try {
      verifySupabaseConnection().then((result) => {
        if (result.ok) {
          console.log("[Supabase]", result.message, result.details);
        } else {
          console.warn("[Supabase]", result.message);
        }
      }).catch((err) => {
        console.warn("[Supabase] Connection check failed:", err.message);
      });
    } catch (err) {
      console.warn("[Supabase] Connection check error:", err.message);
    }
  }, []);

  function RequireAdmin({ children }) {
    const navigate = useNavigate();

    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'var(--accent)',
          fontSize: '18px'
        }}>
          Loading...
        </div>
      );
    }

    if (!session) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          background: 'var(--bg-color)',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '500px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 8px 32px var(--card-shadow)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🔐</div>
            <h1 style={{
              color: 'var(--accent)',
              marginBottom: '1rem',
              fontSize: '28px',
              fontWeight: '700'
            }}>
              Authentication Required
            </h1>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '2rem',
              fontSize: '16px',
              lineHeight: '1.6'
            }}>
              You need to be logged in as an administrator to access the admin dashboard.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🔑 Admin Login
              </button>
              <button
                onClick={() => navigate('/demodashbaard')}
                style={{
                  background: 'var(--card-bg-solid)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                📊 Demo Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          background: 'var(--bg-color)',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 8px 32px var(--card-shadow)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🚫</div>
            <h1 style={{
              color: 'var(--error-color)',
              marginBottom: '1rem',
              fontSize: '28px',
              fontWeight: '700'
            }}>
              Access Denied
            </h1>
            <p style={{
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              fontSize: '16px',
              lineHeight: '1.6'
            }}>
              Your account does not have administrator privileges. Only authorized administrators can access this area.
            </p>
            <div style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '2rem',
              fontSize: '14px',
              color: 'var(--text-secondary)'
            }}>
              <strong style={{ color: 'var(--error-color)' }}>Logged in as:</strong> {session?.user?.email}
            </div>
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '14px',
              marginBottom: '2rem'
            }}>
              Need admin access? Contact the system administrator to request permissions.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🏠 Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/demodashbaard')}
                style={{
                  background: 'var(--card-bg-solid)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                📊 Demo Dashboard
              </button>
              <button
                onClick={() => navigate('/access')}
                style={{
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '15px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(255,122,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                📧 Request Access
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--accent)' }}>Loading...</div>}>
      <Routes>
        {/* Landing page - standalone, no sidebar */}
        <Route path="/" element={<Landing />} />

        {/* Auth routes - standalone layout */}
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/*" element={<NotFound />} />

        {/* Main app routes - with sidebar and bottom nav */}
        <Route
          path="/*"
          element={
            <div className="app-container" style={{ display: "flex" }}>
              <Sidebar
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                onDevToolsToggle={devtoolsEnabled ? (() => setDevToolsOpen((v) => !v)) : undefined}
              />
              <div
                className="main-content"
                style={{
                  marginLeft: "0",
                  flexGrow: 1,
                  transition: "margin-left 0.3s ease",
                  paddingBottom: "80px" /* Space for BottomNav */
                }}
              >
                {/* CSS handles the desktop margin-left, we keep it 0 inline to let CSS take over or dynamically setting it? 
                    Actually, let's use a class or keep inline style but rely on media query override 
                */}
                <style>{`
                  @media (min-width: 769px) {
                    .main-content {
                      margin-left: 60px !important;
                      padding-bottom: 0 !important;
                    }
                  }
                `}</style>
                <div className="page-container">
                  <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--accent)' }}>Loading page...</div>}>
                    <Routes>
                      {/* Real routes */}
                      <Route index element={<DashboardReal />} />
                      <Route path="dashboard" element={<DashboardReal />} />
                      <Route path="settings" element={<SettingsReal />} />
                      <Route path="access" element={<AccessRequest />} />

                      {/* Demo routes (as requested) */}
                      <Route path="demodashbaard" element={<DashboardDemo />} />
                      <Route path="demosettings" element={<SettingsDemo />} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </div>
                {devtoolsEnabled && (
                  <DevToolsPanel open={devToolsOpen} onClose={() => setDevToolsOpen(false)} />
                )}
              </div>
              <GoToTopButton />
              <BottomNav />
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

// maintanance toggle
const IS_MAINTENANCE = false

function App() {
  // Add global error handlers
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    };

    const handleError = (event) => {
      console.error('Window error:', event.error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (IS_MAINTENANCE) {
    return <MaintenancePage />
  }

  // ClerkProvider must be at the top level to ensure all hooks work
  const clerkWrappedApp = (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <DataProvider>
              <Router>
                <ToastManager />
                <Analytics />
                <ErrorBoundary>
                  <AppContent />
                </ErrorBoundary>
              </Router>
            </DataProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );

  // Wrap with ClerkProvider if feature flag is enabled
  if (USE_CLERK_AUTH && CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        {clerkWrappedApp}
      </ClerkProvider>
    );
  }

  // Otherwise, use Supabase auth (default)
  return clerkWrappedApp;
}

export default App;
