// src/pages/real/DashboardV2Real.jsx
//
// Auth gate for the redesigned dashboard preview, mirroring DashboardReal.jsx's gating
// exactly (same session/user/dashboardAccess checks) so the preview carries the identical
// security posture as the production dashboard rather than a looser one improvised for
// "it's just a preview".

import React, { Suspense, lazy, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

const DashboardV2 = lazy(() => import('../DashboardV2'));

export default function DashboardV2Real() {
  const { session, user, loading, dashboardAccess } = useContext(AuthContext);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--accent)' }}>
        Verifying authentication...
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 20, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Authentication Required</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 500 }}>
          You need to be logged in to preview the redesigned dashboard.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ padding: '12px 24px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500 }}
        >
          Login
        </button>
      </div>
    );
  }

  if (dashboardAccess !== 'real') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 20, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Access Denied</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 500 }}>
          You need "Real Dashboard" access to preview the redesign. Contact an administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading dashboard preview...</div>}>
      <DashboardV2 />
    </Suspense>
  );
}
