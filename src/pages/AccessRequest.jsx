import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import DemoAccessBanner from '../components/DemoAccessBanner';

export default function AccessRequest() {
  const navigate = useNavigate();
  const { dashboardAccess, session, user, loading } = useContext(AuthContext);

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
        Loading...
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!session || !user) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{
          color: 'var(--accent)',
          marginBottom: '1rem',
          fontSize: '2rem',
          fontWeight: 800,
          marginTop: '70px'
        }}>🔒 Login Required</h1>

        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 4px 20px var(--card-shadow)'
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            You need to be logged in to request access to the real dashboard.
          </p>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'var(--accent)',
                color: '#0c0c0c',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '16px'
              }}
            >
              🔐 Login
            </button>
            <button
              onClick={() => navigate('/demodashbaard')}
              style={{
                background: 'var(--hover-bg)',
                color: 'var(--text-color)',
                border: '1px solid var(--glass-border)',
                padding: '12px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              📊 View Demo Dashboard
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', color: 'var(--text-muted)' }}>
          Tip: You can explore the demo dashboard without logging in, but you'll need an account to access real solar data.
        </div>
      </div>
    );
  }

  const hasRealAccess = dashboardAccess === 'real';
  const isDemo = dashboardAccess === 'demo';

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{
        color: 'var(--accent)',
        marginBottom: '1rem',
        fontSize: '2rem',
        fontWeight: 800,
        marginTop: '70px'
      }}>{hasRealAccess ? '✅ Access Granted' : '🔒 Access Required'}</h1>

      {isDemo && <DemoAccessBanner />}

      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 4px 20px var(--card-shadow)'
      }}>
        {hasRealAccess ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              🎉 Congratulations! You now have access to the real dashboard with live solar data.
            </p>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              You currently have demo-only access. To view the real dashboard and manage settings, please contact the admin to request access.
            </p>
          </>
        )}
        <ul style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <li>Email: <a href="mailto:anujajayasinhe@gmail.com" style={{ color: 'var(--accent)' }}>anujajayasinhe@gmail.com</a></li>
          <li>LinkedIn: <a href="https://www.linkedin.com/in/anuja-jayasinghe" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>anujajayasinghe</a></li>
          <li>Website: <a href="https://anujajay.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>anujajay.com</a></li>
        </ul>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {hasRealAccess ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'var(--accent)',
                  color: '#0c0c0c',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '16px'
                }}
              >
                🚀 Go to Real Dashboard
              </button>
              <button
                onClick={() => navigate('/demodashbaard')}
                style={{
                  background: 'var(--hover-bg)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--glass-border)',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                📊 View Demo Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/demodashbaard')}
                style={{
                  background: 'var(--accent)',
                  color: '#0c0c0c',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                🚀 Visit Demo Dashboard
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.25rem', color: 'var(--text-muted)' }}>
        {hasRealAccess 
          ? 'Tip: You can switch between real and demo dashboards anytime.'
          : 'Tip: You can explore all visuals safely in demo mode. Real changes remain protected until access is granted.'
        }
      </div>
    </div>
  );
}
