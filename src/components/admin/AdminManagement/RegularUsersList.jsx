import React from 'react';

/**
 * Regular Users List Component
 * Displays non-admin users with pagination
 */
export default function RegularUsersList({
  users = [],
  currentPage = 1,
  itemsPerPage = 20,
  totalItems = 0,
  onPageChange = () => {},
  onItemsPerPageChange = () => {},
  onRoleChange = () => {},
  loading = false,
  emptyMessage = 'All users are admins'
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (users.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-color)'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Users List */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {users.map(user => (
          <UserRoleRow
            key={user.id}
            user={user}
            role="user"
            onRoleChange={() =>
              onRoleChange(user.id, 'admin', `${user.firstName} ${user.lastName}`)
            }
            buttonLabel="Promote to Admin"
            buttonColor="#28a745"
            loading={loading}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalItems > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '13px'
        }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            Showing {Math.min(startIndex + 1, totalItems)}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                backgroundColor: currentPage === 1 ? '#f0f0f0' : '#1976d2',
                color: currentPage === 1 ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              ← Prev
            </button>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: '6px 12px',
                backgroundColor: currentPage >= totalPages ? '#f0f0f0' : '#1976d2',
                color: currentPage >= totalPages ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              Next →
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Per page:
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={loading}
              style={{
                padding: '6px 8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '13px',
                backgroundColor: 'var(--card-bg-solid)',
                color: 'var(--text-color)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single User Role Row
 */
function UserRoleRow({ user, role, onRoleChange, buttonLabel, buttonColor, loading }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '1rem',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: '1px solid var(--border-color)',
      transition: 'all 0.2s ease'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {user.email}
        </div>
        <div style={{
          fontSize: '12px',
          marginTop: '0.5rem',
          display: 'inline-block',
          padding: '4px 8px',
          background: role === 'admin' ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)',
          color: role === 'admin' ? '#dc3545' : '#28a745',
          borderRadius: '4px'
        }}>
          {role === 'admin' ? '👑 Admin' : '👤 Regular User'}
        </div>
      </div>
      <button
        onClick={onRoleChange}
        disabled={loading}
        style={{
          padding: '8px 16px',
          background: buttonColor,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
          marginLeft: '1rem',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.target.style.opacity = '0.8';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.target.style.opacity = '1';
          }
        }}
      >
        {loading ? '⏳' : buttonLabel}
      </button>
    </div>
  );
}
