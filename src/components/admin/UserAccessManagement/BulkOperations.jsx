import React from 'react';

/**
 * Bulk Operations Component
 * Displays buttons for bulk user actions
 */
export default function BulkOperations({
  selectedCount = 0,
  onGrantRealAccess = () => {},
  onSetDemo = () => {},
  loading = false,
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      padding: '1rem',
      marginBottom: '1.5rem',
      background: 'var(--card-bg)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      borderLeft: '4px solid var(--accent)'
    }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>
        {selectedCount} selected:
      </span>

      <button
        onClick={onGrantRealAccess}
        disabled={loading}
        style={{
          padding: '8px 14px',
          background: '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => !loading && (e.target.style.background = '#219653')}
        onMouseLeave={(e) => !loading && (e.target.style.background = '#28a745')}
      >
        ✅ Grant Real Access
      </button>

      <button
        onClick={onSetDemo}
        disabled={loading}
        style={{
          padding: '8px 14px',
          background: '#ffc107',
          color: '#000',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => !loading && (e.target.style.background = '#e0a800')}
        onMouseLeave={(e) => !loading && (e.target.style.background = '#ffc107')}
      >
        🧪 Set to Demo
      </button>
    </div>
  );
}
