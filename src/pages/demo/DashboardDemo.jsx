import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoDataProvider } from '../../contexts/DemoDataContext';
import { UserPlus, Home } from 'lucide-react';

// Reuse the exact same Dashboard layout/components
const Dashboard = lazy(() => import('../Dashboard'));

export default function DashboardDemo() {
  const navigate = useNavigate();

  return (
    <DemoDataProvider>
      {/* Demo Mode Banner - glassy effect */}
      <div style={{
        position: 'fixed',
        top: '50px',
        left: '60px',
        right: '0',
        height: '48px',
        background: 'rgba(251, 191, 36, 0.15)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 998,
        borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
        boxShadow: '0 4px 20px rgba(251, 191, 36, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--accent)',
          fontSize: '15px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
        }}>
          <span style={{ 
            fontSize: '24px',
            animation: 'pulse 2s ease-in-out infinite'
          }}>⚠️</span>
          <span>Demo Mode - Viewing Sample Data</span>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            color: 'var(--text-color)',
            fontWeight: '600',
            marginRight: '4px',
            opacity: 0.9
          }}>Want real access?</span>
          <button 
            onClick={() => navigate('/', { state: { from: 'dashboard' } })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'var(--text-color)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            title="Go to landing page"
          >
            <Home size={14} />
            <span>Home</span>
          </button>
          
          <button 
            onClick={() => navigate('/access')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(251, 191, 36, 0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'var(--accent)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(251, 191, 36, 0.4)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(251, 191, 36, 0.3)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            title="Request access to real dashboard"
          >
            <UserPlus size={14} />
            <span>Request Access</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>

      {/* Add padding to account for fixed title bar and banner */}
      <div style={{ paddingTop: '98px' }}>
        <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading demo dashboard...</div>}>
          <Dashboard />
        </Suspense>
      </div>
    </DemoDataProvider>
  );
}
