import React, { Suspense, lazy } from 'react';
import { DemoDataProvider } from '../../contexts/DemoDataContext';

// Reuse the existing Settings page UI (view-only intent for demo)
const Settings = lazy(() => import('../Settings'));

export default function SettingsDemo() {
  return (
    <DemoDataProvider>
      <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading demo settings...</div>}>
        <div>
          {/* Informational banner only; functional blocking will be wired later via AuthContext */}
          <div style={{
            margin: '0.5rem 0 1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(255, 193, 7, 0.08)',
            border: '1px solid rgba(255, 193, 7, 0.25)',
            color: '#ffc107',
            textAlign: 'center'
          }}>
            ⚠️ Demo Mode — Settings are displayed for preview only.
          </div>
          <Settings />
        </div>
      </Suspense>
    </DemoDataProvider>
  );
}
