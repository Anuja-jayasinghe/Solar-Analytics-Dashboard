import React, { Suspense, lazy, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

// Real dashboard simply reuses the existing page
const Dashboard = lazy(() => import('../Dashboard'));

export default function DashboardReal() {
  const { session, user, loading } = useContext(AuthContext);
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
          You need to be logged in to access the real dashboard. Please log in to continue.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
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
          <button 
            onClick={() => navigate('/demodashbaard')}
            style={{
              padding: '12px 24px',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            Try Demo Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading real dashboard...</div>}>
      <Dashboard />
    </Suspense>
  );
}
