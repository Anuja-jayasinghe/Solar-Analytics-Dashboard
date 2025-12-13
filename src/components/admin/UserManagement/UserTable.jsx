import React from 'react';

export default function UserTable({ users, loading, onRoleChange, onAccessChange }) {
  if (users.length === 0) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '3rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>👤</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
          No users found
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px var(--card-shadow)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--card-border)' }}>
              <th style={headerStyle}>User</th>
              <th style={headerStyle}>Email</th>
              <th style={headerStyle}>Role</th>
              <th style={headerStyle}>Dashboard Access</th>
              <th style={headerStyle}>Joined</th>
              <th style={headerStyle}>Last Sign In</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                style={{
                  borderBottom: index < users.length - 1 ? '1px solid var(--card-border)' : 'none',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : 'No Name'}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    {user.email || 'No email'}
                  </span>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onRoleChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.role === 'admin' ? '#8b5cf620' : '#10b98120',
                      color: user.role === 'admin' ? '#8b5cf6' : '#10b981',
                      border: `1px solid ${user.role === 'admin' ? '#8b5cf640' : '#10b98140'}`,
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="user">👤 User</option>
                    <option value="admin">🔑 Admin</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.dashboardAccess || 'demo'}
                    onChange={(e) => onAccessChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.dashboardAccess === 'real' ? '#f59e0b20' : '#6b728020',
                      color: user.dashboardAccess === 'real' ? '#f59e0b' : '#6b7280',
                      border: `1px solid ${user.dashboardAccess === 'real' ? '#f59e0b40' : '#6b728040'}`,
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="demo">📊 Demo</option>
                    <option value="real">✅ Real</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </span>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : 'Never'}
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

const headerStyle = {
  textAlign: 'left',
  padding: '1rem',
  color: 'var(--text-color)',
  fontWeight: '600',
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const cellStyle = {
  padding: '1rem',
  color: 'var(--text-color)'
};
