import { useEffect, useState, useContext } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../components/ThemeContext";
import Dashboard from "./Dashboard";

function Admin() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/admin"); // not logged in → back to login
      } else {
        setSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/admin");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (!session) return <div className="admin-page-layout"><div className="admin-header"><p>Loading...</p></div></div>;

  return (
    <div className="admin-page-layout">
      <div className="admin-header">
        <h1>Welcome Admin 🚀</h1>
        <p>Logged in as: {session.user.email}</p>
        <button 
          onClick={handleLogout}
          className="logout-btn"
        >
          Logout
        </button>
      </div>

      {/* Your solar dashboard inside admin */}
      <div className="admin-dashboard-container">
        <Dashboard />
      </div>
    </div>
  );
}

export default Admin;
