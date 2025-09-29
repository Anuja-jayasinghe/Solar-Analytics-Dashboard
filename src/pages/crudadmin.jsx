import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CrudAdmin() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/admin"); // not logged in → back to login
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="crud-admin-container">
      <h1>Welcome Admin 👋</h1>
      <p>Logged in as: {user?.email}</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate("/admin");
        }}
        className="logout-btn"
      >
        Logout
      </button>
    </div>
  );
}
