import React from 'react';
import { formatDateDDMMYYYY } from '../../../lib/dateFormatter';

export default function UserTable({ users, loading, onRoleChange, onAccessChange, selectedUsers, onToggleSelect, onSelectAll }) {
  if (users.length === 0) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '3rem',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        No users found
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: 'var(--accent)',
    fontWeight: '600',
    fontSize: '12px',
    borderBottom: '2px solid var(--border-color)'
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: 'var(--text-color)',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)'
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ ...headerStyle, width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onChange={onSelectAll}
                  disabled={users.length === 0}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </th>
              <th style={headerStyle}>User</th>
              <th style={headerStyle}>Email</th>
              <th style={headerStyle}>Role</th>
              <th style={headerStyle}>Access</th>
              <th style={headerStyle}>Joined</th>
              <th style={headerStyle}>Last Sign-in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                style={{ transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td data-label="" style={cellStyle}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => onToggleSelect(user.id)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
                <td data-label="User" style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ fontWeight: '600' }}>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : 'Unnamed User'}
                    </div>
                  </div>
                </td>
                <td data-label="Email" style={cellStyle}>
                  <span style={{ color: 'var(--text-secondary)' }}>{user.email || 'No email'}</span>
                </td>
                <td data-label="Role" style={cellStyle}>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onRoleChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.role === 'admin' ? 'rgba(220, 53, 69, 0.12)' : 'var(--card-bg-solid)',
                      color: user.role === 'admin' ? 'var(--error-color)' : 'var(--text-color)',
                      border: `1px solid ${user.role === 'admin' ? 'var(--error-color)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td data-label="Access" style={cellStyle}>
                  <select
                    value={user.dashboardAccess || 'demo'}
                    onChange={(e) => onAccessChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.dashboardAccess === 'real' ? 'rgba(245, 158, 11, 0.12)' : 'var(--card-bg-solid)',
                      color: user.dashboardAccess === 'real' ? 'var(--warning-color)' : 'var(--text-muted)',
                      border: `1px solid ${user.dashboardAccess === 'real' ? 'var(--warning-color)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="demo">Demo</option>
                    <option value="real">Real</option>
                  </select>
                </td>
                <td data-label="Joined" style={cellStyle}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateDDMMYYYY(user.createdAt)}
                  </span>
                </td>
                <td data-label="Last Sign-in" style={cellStyle}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateDDMMYYYY(user.lastSignInAt, 'Never')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
