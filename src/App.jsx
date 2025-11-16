// App.js
import { useState, useEffect, useContext, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeContext";
import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import GoToTopButton from "./components/GoToTopButton";
import "./index.css";
import { verifySupabaseConnection } from "./lib/verifySupabaseConnection";
import { Analytics } from "@vercel/analytics/react"
import MaintenancePage from "./pages/MaintenancePage";

// Lazy load pages for better code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AppContent() {
  const { isAdmin, loading, session } = useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        {/* Admin routes - standalone layout */}
        <Route path="/admin" element={<AdminLogin />} />
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
              <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
              <div
                className="main-content"
                style={{
                  marginLeft: "60px",
                  flexGrow: 1,
                  transition: "margin-left 0.3s ease",
                }}
              >
                <Navbar />
                <div className="page-container">
                  <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--accent)' }}>Loading page...</div>}>
                    <Routes>
                      <Route index element={<Dashboard />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </div>
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

  if (IS_MAINTENANCE){
    return <MaintenancePage/>
  }
  return (
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <Router>
            <Analytics/>
            <AppContent />
          </Router>
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
