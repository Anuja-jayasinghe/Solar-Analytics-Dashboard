import React from 'react';

export default function DemoBlockModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--card-bg-solid)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        width: 'min(520px, 92vw)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
      }}>
        <div style={{
          fontWeight: 700,
          color: 'rgba(220, 53, 69, 0.95)',
          marginBottom: '0.5rem'
        }}>🚫 Demo Account</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Settings changes are not allowed. Contact admin for real access.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 0.9rem',
            borderRadius: '8px',
            background: 'var(--accent)',
            border: 'none',
            color: '#0c0c0c',
            fontWeight: 600,
            cursor: 'pointer'
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
