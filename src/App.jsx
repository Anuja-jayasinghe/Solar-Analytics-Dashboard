// App.js
import React, { useState, useEffect, useContext, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
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

function AppContent() {
  const { isAdmin, loading, session } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const devtoolsEnabled = (import.meta?.env?.VITE_ENABLE_DEVTOOLS ?? 'true') === 'true';

  useEffect(() => {
    verifySupabaseConnection().then((result) => {
      if (result.ok) {
        console.log("[Supabase]", result.message, result.details);
      } else {
        console.error("[Supabase]", result.message);
      }
    });
  }, []);

  function RequireAdmin({ children }) {
    if (loading) return <p>Loading...</p>;
    if (!session) return <p>Not authenticated. Please log in at /admin.</p>;
    if (!isAdmin) return <p>Access denied. Your account is not an admin.</p>;
    return children;
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--accent)' }}>Loading...</div>}>
      <Routes>
        {/* Landing page - standalone, no sidebar */}
        <Route path="/" element={<Landing />} />

        {/* Auth routes - standalone layout */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route path="/admin/*" element={<NotFound />} />

        {/* Main app routes - with sidebar and navbar */}
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
                  marginLeft: "60px",
                  flexGrow: 1,
                  transition: "margin-left 0.3s ease",
                }}
              >
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

  if (IS_MAINTENANCE){
    return <MaintenancePage/>
  }

  // Conditionally wrap with ClerkProvider if using Clerk auth
  const appTree = (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <DataProvider>
              <Router>
                <Analytics/>
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
        {appTree}
      </ClerkProvider>
    );
  }

  // Otherwise, use Supabase auth (default)
  return appTree;
}

export default App;
