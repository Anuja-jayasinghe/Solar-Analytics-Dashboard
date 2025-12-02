import React from 'react';

export default function DemoAccessBanner() {
  return (
    <div style={{
      margin: '0.5rem 0 1rem',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      background: 'rgba(255, 193, 7, 0.08)',
      border: '1px solid rgba(255, 193, 7, 0.25)',
      color: '#ffc107',
      textAlign: 'center'
    }}>
      ⚠️ Demo Mode — You're viewing in read-only mode. Changes won't be saved.
    </div>
  );
}
