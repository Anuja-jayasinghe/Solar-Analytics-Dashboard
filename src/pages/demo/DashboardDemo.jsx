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
      {/* Demo Mode Banner - permanent, transparent, top bar */}
      <div style={{
        position: 'fixed',
        top: '0',
        left: '60px',
        right: '0',
        height: '40px',
        background: 'linear-gradient(90deg, rgba(255, 243, 205, 0.95), rgba(255, 234, 167, 0.85))',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 999,
        borderBottom: '1px solid rgba(255, 234, 167, 0.5)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#856404',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          Demo Mode - Sample Data Only
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#856404',
              border: '1px solid rgba(133, 100, 4, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 1)';
              e.target.style.transform = 'scale(1.1)';
              e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.9)';
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
            title="Go to landing page"
          >
            <Home size={16} />
          </button>
          
          <button 
            onClick={() => navigate('/access')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.1)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
            title="Request access to real dashboard"
          >
            <UserPlus size={16} />
          </button>
        </div>
      </div>

      {/* Add padding to account for fixed banner */}
      <div style={{ paddingTop: '40px' }}>
        <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading demo dashboard...</div>}>
          <Dashboard />
        </Suspense>
      </div>
    </DemoDataProvider>
  );
}
