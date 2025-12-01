import React, { Suspense, lazy } from 'react';
import { DemoDataProvider } from '../../contexts/DemoDataContext';

// Reuse the exact same Dashboard layout/components
const Dashboard = lazy(() => import('../Dashboard'));

export default function DashboardDemo() {
  return (
    <DemoDataProvider>
      <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading demo dashboard...</div>}>
        <Dashboard />
      </Suspense>
    </DemoDataProvider>
  );
}
