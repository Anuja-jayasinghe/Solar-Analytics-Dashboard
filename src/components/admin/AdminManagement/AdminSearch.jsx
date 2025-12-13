import React from 'react';

/**
 * Admin Search Component
 * Search bar for filtering admins and regular users
 */
export default function AdminSearch({ searchQuery = '', onSearchChange = () => {} }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <input
        type="text"
        placeholder="🔍 Search users by email or name..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          color: 'var(--text-color)',
          fontSize: '14px',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease'
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
      />
    </div>
  );
}
