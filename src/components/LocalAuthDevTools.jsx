import React, { useState, useEffect } from 'react';
import { setLocalRole, setLocalAccess, TEST_USERS, debugLocalAuth, getLocalAuthState } from '../lib/localAuth';

const IS_LOCAL_DEV = import.meta.env.MODE === 'development';

/**
 * Local Auth Dev Tools Panel
 * Provides quick controls for testing Clerk authentication locally
 * Only visible in development mode
 * 
 * Usage: Add <LocalAuthDevTools /> to your main App component
 */
const LocalAuthDevTools = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState(null);

  // Listen for auth changes
  useEffect(() => {
    if (!IS_LOCAL_DEV) return;

    const updateAuth = () => {
      setAuthState(getLocalAuthState());
    };

    // Initial state
    updateAuth();

    // Listen for auth changes from other tabs/components
    window.addEventListener('local-auth-change', updateAuth);
    return () => window.removeEventListener('local-auth-change', updateAuth);
  }, []);

  if (!IS_LOCAL_DEV) return null;

  const role = authState?.user?.publicMetadata?.role;
  const access = authState?.user?.publicMetadata?.dashboardAccess;
  const email = authState?.user?.primaryEmailAddress?.emailAddress;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10000,
        fontFamily: 'monospace',
        fontSize: '12px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: isOpen ? '10px' : '0',
          fontSize: '11px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s'
        }}
        onMouseOver={e => e.target.style.background = '#45a049'}
        onMouseOut={e => e.target.style.background = '#4CAF50'}
      >
        🔧 Local Auth {isOpen ? '▼' : '▶'}
      </button>

      {isOpen && (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '280px',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            color: 'white'
          }}
        >
          {/* Current State */}
          <div
            style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '8px',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '11px'
            }}
          >
            <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>📊 Current State</div>
            <div>Email: {email}</div>
            <div>Role: <span style={{ fontWeight: 'bold', color: role === 'admin' ? '#FFD700' : '#90EE90' }}>{role}</span></div>
            <div>Access: <span style={{ fontWeight: 'bold', color: access === 'real' ? '#90EE90' : '#FFB6C1' }}>{access}</span></div>
          </div>

          {/* Role Buttons */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>👥 Role Management</div>
            <ButtonRow>
              <Button
                onClick={() => setLocalRole('admin')}
                active={role === 'admin'}
              >
                👑 Admin
              </Button>
              <Button
                onClick={() => setLocalRole('user')}
                active={role === 'user'}
              >
                👤 User
              </Button>
            </ButtonRow>
          </div>

          {/* Access Buttons */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>📊 Dashboard Access</div>
            <ButtonRow>
              <Button
                onClick={() => setLocalAccess('real')}
                active={access === 'real'}
              >
                ✅ Real
              </Button>
              <Button
                onClick={() => setLocalAccess('demo')}
                active={access === 'demo'}
              >
                🧪 Demo
              </Button>
            </ButtonRow>
          </div>

          {/* Quick Test Users */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>⚡ Quick Users</div>
            <ButtonColumn>
              <SmallButton onClick={() => TEST_USERS.ADMIN_REAL()}>
                👑 Admin (Real)
              </SmallButton>
              <SmallButton onClick={() => TEST_USERS.USER_REAL()}>
                👤 User (Real)
              </SmallButton>
              <SmallButton onClick={() => TEST_USERS.USER_DEMO()}>
                🧪 User (Demo)
              </SmallButton>
              <SmallButton onClick={() => TEST_USERS.ADMIN_DEMO()}>
                👑 Admin (Demo)
              </SmallButton>
            </ButtonColumn>
          </div>

          {/* Utilities */}
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '11px' }}>🛠️ Utilities</div>
            <ButtonColumn>
              <SmallButton
                onClick={() => {
                  debugLocalAuth();
                  alert('Check console for debug info (F12)');
                }}
                style={{ background: '#FF6B6B' }}
              >
                🐛 Debug Console
              </SmallButton>
              <SmallButton
                onClick={() => {
                  if (window.__LOCAL_AUTH__) {
                    window.__LOCAL_AUTH__.clear();
                    window.location.reload();
                  }
                }}
                style={{ background: '#FF6B6B' }}
              >
                🔄 Reset Auth
              </SmallButton>
            </ButtonColumn>
          </div>

          {/* Info */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              fontSize: '10px',
              opacity: 0.8
            }}
          >
            💡 Use <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '2px' }}>window.__LOCAL_AUTH__</code> in console
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const ButtonRow = ({ children }) => (
  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
    {children}
  </div>
);

const ButtonColumn = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    {children}
  </div>
);

const Button = ({ onClick, active, children }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '6px 8px',
      background: active ? '#FFD700' : 'rgba(255,255,255,0.2)',
      color: active ? '#000' : '#fff',
      border: active ? '2px solid #FFC700' : '1px solid rgba(255,255,255,0.3)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: active ? 'bold' : 'normal',
      transition: 'all 0.2s'
    }}
    onMouseOver={e => {
      if (!active) {
        e.target.style.background = 'rgba(255,255,255,0.3)';
      }
    }}
    onMouseOut={e => {
      if (!active) {
        e.target.style.background = 'rgba(255,255,255,0.2)';
      }
    }}
  >
    {children}
  </button>
);

const SmallButton = ({ onClick, children, style = {} }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      padding: '6px 8px',
      background: style.background || 'rgba(255,255,255,0.2)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '11px',
      transition: 'all 0.2s'
    }}
    onMouseOver={e => {
      e.target.style.background = style.background ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255,255,255,0.3)';
      e.target.style.transform = 'scale(1.02)';
    }}
    onMouseOut={e => {
      e.target.style.background = style.background || 'rgba(255,255,255,0.2)';
      e.target.style.transform = 'scale(1)';
    }}
  >
    {children}
  </button>
);

export default LocalAuthDevTools;
