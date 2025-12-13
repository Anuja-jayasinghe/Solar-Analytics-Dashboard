import React, { Suspense, lazy, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

// Real settings reuses the existing page
const Settings = lazy(() => import('../Settings'));

export default function SettingsReal() {
  const { session, user, loading, dashboardAccess } = useContext(AuthContext);
  const navigate = useNavigate();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--accent)'
      }}>
        Verifying authentication...
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!session || !user) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h2 style={{ margin: '0', color: 'var(--text-primary)' }}>Authentication Required</h2>
        <p style={{ margin: '0', color: 'var(--text-secondary)', maxWidth: '500px' }}>
          You need to be logged in to access settings. Please log in to continue.
        </p>
        <button 
          onClick={() => navigate('/login')}
          style={{
            padding: '12px 24px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Login
        </button>
      </div>
    );
  }

  // Check if user has real dashboard access
  if (dashboardAccess !== 'real') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px' }}>🚫</div>
        <h2 style={{ margin: '0', color: 'var(--text-primary)' }}>Access Denied</h2>
        <p style={{ margin: '0', color: 'var(--text-secondary)', maxWidth: '500px' }}>
          You need "Real Dashboard" access to view settings. Please contact an administrator to request access.
        </p>
        <button 
          onClick={() => navigate('/demodashbaard')}
          style={{
            padding: '12px 24px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Go to Demo Dashboard
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading real settings...</div>}>
      <Settings />
    </Suspense>
  );
}
