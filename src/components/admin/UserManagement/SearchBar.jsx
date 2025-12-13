import React from 'react';

export default function SearchBar({ searchQuery, setSearchQuery, resultCount, totalCount }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '20px' }}>🔍</span>
        <input
          type="text"
          placeholder="Search users by name, email, role, or access..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-color)',
            fontSize: '15px',
            padding: '0.5rem 0'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'var(--hover-bg)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              color: 'var(--text-color)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Clear
          </button>
        )}
      </div>
      {searchQuery && (
        <div style={{
          marginTop: '0.75rem',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          Showing {resultCount} of {totalCount} users
        </div>
      )}
    </div>
  );
}
