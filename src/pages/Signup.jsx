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
          Sign up to request dashboard access
        </p>
      </div>
      
      <SignUp 
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
        signInUrl="/login"
        afterSignUpUrl="/access"
        redirectUrl="/access"
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
