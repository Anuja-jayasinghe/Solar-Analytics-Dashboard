import React, { Suspense, lazy, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { LogOut } from 'lucide-react';

// Real dashboard simply reuses the existing page
const Dashboard = lazy(() => import('../Dashboard'));

export default function DashboardReal() {
  const { session, user, loading, signOut } = useContext(AuthContext);
  const navigate = useNavigate();

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

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
            onClick={() => navigate('/admin')}
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
    <>
      {/* Logout button in sidebar style - fixed left position */}
      <div style={{
        position: 'fixed',
        left: '8px',
        bottom: '80px',
        zIndex: 1000
      }}>
        <button 
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#ff4444';
            e.target.style.color = 'white';
            e.target.style.borderColor = '#ff4444';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'var(--card-bg)';
            e.target.style.color = 'var(--text-primary)';
            e.target.style.borderColor = 'var(--border-color)';
            e.target.style.transform = 'scale(1)';
          }}
          title={`Logout (${user.email})`}
        >
          <LogOut size={20} />
        </button>
      </div>

      <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading real dashboard...</div>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
