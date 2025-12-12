import React from 'react';

/**
 * User Table Component
 * Displays users in a table with pagination controls
 */
export default function UserTable({
  users = [],
  selectedUsers = new Set(),
  onToggleSelect = () => {},
  onSelectAll = () => {},
  onAccessChange = () => {},
  loading = false,
  currentPage = 1,
  itemsPerPage = 20,
  totalItems = 0,
  onPageChange = () => {},
  onItemsPerPageChange = () => {},
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
        <p style={{ margin: 0 }}>No users found</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Table */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 100px 120px 120px',
          gap: '0',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--card-border)',
          padding: '1rem',
          fontWeight: 'bold',
          fontSize: '13px'
        }}>
          <input
            type="checkbox"
            checked={selectedUsers.size === users.length && users.length > 0}
            onChange={onSelectAll}
            style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            disabled={users.length === 0}
          />
          <div>User</div>
          <div style={{ textAlign: 'center' }}>Role</div>
          <div style={{ textAlign: 'center' }}>Access</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {/* Rows */}
        {users.map((user, idx) => (
          <UserTableRow
            key={user.id}
            user={user}
            isSelected={selectedUsers.has(user.id)}
            onToggleSelect={() => onToggleSelect(user.id)}
            onAccessChange={onAccessChange}
            loading={loading}
            isLast={idx === users.length - 1}
          />
        ))}
      </div>

      {/* Pagination Controls */}
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
              fontSize: '13px',
              fontWeight: '600'
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
              fontSize: '13px',
              fontWeight: '600'
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
    </div>
  );
}

/**
 * Single User Table Row
 */
function UserTableRow({
  user,
  isSelected,
  onToggleSelect,
  onAccessChange,
  loading,
  isLast,
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr 100px 120px 120px',
      gap: '0',
      alignItems: 'center',
      padding: '1rem',
      borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      background: isSelected ? 'rgba(255, 122, 0, 0.1)' : 'transparent',
      transition: 'background 0.2s ease'
    }}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        style={{ cursor: 'pointer', width: '20px', height: '20px' }}
      />

      {/* User Info */}
      <div>
        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {user.email}
        </div>
      </div>

      {/* Role Badge */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          background: user.role === 'admin' ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)',
          color: user.role === 'admin' ? '#dc3545' : '#28a745',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {user.role === 'admin' ? '👑 Admin' : '👤 User'}
        </span>
      </div>

      {/* Access Badge */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 8px',
          background: user.dashboardAccess === 'real' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
          color: user.dashboardAccess === 'real' ? '#28a745' : '#ffc107',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {user.dashboardAccess === 'real' ? '✅ Real' : '🧪 Demo'}
        </span>
      </div>

      {/* Toggle Access Button */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        {user.dashboardAccess === 'real' ? (
          <button
            onClick={() => onAccessChange(user.id, 'demo')}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#e0a800')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#ffc107')}
          >
            📊 Demo
          </button>
        ) : (
          <button
            onClick={() => onAccessChange(user.id, 'real')}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#219653')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#28a745')}
          >
            ✅ Real
          </button>
        )}
      </div>
    </div>
  );
}
