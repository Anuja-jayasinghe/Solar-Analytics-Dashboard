// App.js
import { useState, useEffect, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeContext";
import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import "./index.css";
import { verifySupabaseConnection } from "./lib/verifySupabaseConnection";

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
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="settings" element={<Settings />} />
                </Routes>
              </div>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
