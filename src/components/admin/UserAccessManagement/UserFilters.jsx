import React from 'react';

/**
 * User Filters Component
 * Handles search, role filter, and access level filter
 */
export default function UserFilters({
  searchQuery = '',
  onSearchChange = () => {},
  filterRole = 'all',
  onRoleChange = () => {},
  filterAccess = 'all',
  onAccessChange = () => {},
}) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '1.5rem',
      borderRadius: '8px',
      marginBottom: '1.5rem',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem'
      }}>
        {/* Search Input */}
        <input
          type="text"
          placeholder="🔍 Search by email or name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg-solid)',
            color: 'var(--text-color)',
            fontSize: '14px'
          }}
        />

        {/* Role Filter */}
        <select
          value={filterRole}
          onChange={(e) => onRoleChange(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg-solid)',
            color: 'var(--text-color)',
            fontSize: '14px'
          }}
        >
          <option value="all">👥 All Roles</option>
          <option value="user">👤 Regular Users</option>
          <option value="admin">👑 Admins</option>
        </select>

        {/* Access Filter */}
        <select
          value={filterAccess}
          onChange={(e) => onAccessChange(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg-solid)',
            color: 'var(--text-color)',
            fontSize: '14px'
          }}
        >
          <option value="all">📊 All Access Levels</option>
          <option value="real">✅ Real Access</option>
          <option value="demo">🧪 Demo Access</option>
        </select>
      </div>
    </div>
  );
}
