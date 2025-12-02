import React from "react";
import { SignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

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
          Create Account
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Sign up to access the demo dashboard
        </p>
      </div>
      
      <SignUp 
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
        path="/signup"
        signInUrl="/admin"
        afterSignUpUrl="/demodashbaard"
        redirectUrl="/demodashbaard"
      />
      
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{ 
            background: 'transparent', 
            color: 'var(--text-secondary)', 
            padding: "8px 16px", 
            border: '1px solid var(--border-color)',
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
