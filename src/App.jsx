import { useContext, useEffect } from "react";
import { ThemeProvider, ThemeContext } from "./components/ThemeContext";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import "./index.css";
import { verifySupabaseConnection } from "./lib/verifySupabaseConnection";

function AppContent() {
  useEffect(() => {
    verifySupabaseConnection().then((result) => {
      if (result.ok) {
        console.log("[Supabase]", result.message, result.details);
      } else {
        console.error("[Supabase]", result.message);
      }
    });
  }, []);
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
