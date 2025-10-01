import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { AuthContext } from "../contexts/AuthContext";

function AdminTest() {
  const navigate = useNavigate();
  const { session } = useContext(AuthContext);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (!session) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '3rem',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
      }}>
        <h1 style={{ 
          fontSize: '3rem', 
          marginBottom: '1rem',
          background: 'linear-gradient(45deg, #fff, #f0f0f0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🚀 Welcome Admin!
        </h1>
        
        <p style={{ 
          fontSize: '1.2rem', 
          marginBottom: '2rem',
          opacity: 0.9
        }}>
          Logged in as: <strong>{session.user.email}</strong>
        </p>
        
        <p style={{ 
          fontSize: '1rem', 
          marginBottom: '2rem',
          opacity: 0.8
        }}>
          You have successfully accessed the admin area.
        </p>
        
        <button 
          onClick={handleLogout}
          style={{
            background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
            color: 'white',
            border: 'none',
            padding: '12px 30px',
            borderRadius: '25px',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px 0 rgba(255, 107, 107, 0.4)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px 0 rgba(255, 107, 107, 0.6)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px 0 rgba(255, 107, 107, 0.4)';
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

export default AdminTest;
