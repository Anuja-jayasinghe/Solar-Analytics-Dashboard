import React, { Suspense, lazy } from 'react';

// Real settings reuses the existing page
const Settings = lazy(() => import('../Settings'));

export default function SettingsReal() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading real settings...</div>}>
      <Settings />
    </Suspense>
  );
}
