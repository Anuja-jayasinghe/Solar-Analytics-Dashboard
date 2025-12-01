import React, { Suspense, lazy } from 'react';

// Real dashboard simply reuses the existing page
const Dashboard = lazy(() => import('../Dashboard'));

export default function DashboardReal() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading real dashboard...</div>}>
      <Dashboard />
    </Suspense>
  );
}
