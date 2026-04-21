import React, { useContext } from 'react';
import { formatDateDDMMYYYY } from '../../../lib/dateFormatter';
import { AdminThemeContext } from '../../../contexts/AdminThemeContext';
import { getAdminTheme } from '../adminTheme';

export default function UserTable({ users, loading, onRoleChange, onAccessChange }) {
  const { selectedTheme, adminColorPresets } = useContext(AdminThemeContext);
  const theme = getAdminTheme(adminColorPresets[selectedTheme]);

  if (users.length === 0) {
    return (
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        padding: '3rem',
        textAlign: 'center',
        fontFamily: theme.fonts.mono
      }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.5 }}>[!]</div>
        <div style={{ color: theme.colors.textMuted, fontSize: '14px', letterSpacing: '1px' }}>
          ZERO_RECORDS_FOUND_IN_NODE
        </div>
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: theme.colors.accent,
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    borderBottom: `2px solid ${theme.colors.borderStrong}`,
    fontFamily: theme.fonts.mono
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: theme.colors.text,
    fontSize: '13px',
    fontFamily: theme.fonts.mono,
    borderBottom: `1px solid ${theme.colors.border}`
  };

  return (
    <div style={{
      background: 'transparent',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={headerStyle}>IDENTIFIER</th>
              <th style={headerStyle}>NETWORK_ADDR</th>
              <th style={headerStyle}>ROLE_LVL</th>
              <th style={headerStyle}>ACCESS_POL</th>
              <th style={headerStyle}>INIT_TS</th>
              <th style={headerStyle}>LAST_ACK</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                style={{
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '2px',
                      background: `linear-gradient(135deg, ${theme.colors.accent}40, ${theme.colors.accent}10)`,
                      border: `1px solid ${theme.colors.accent}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: '12px'
                    }}>
                      {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ fontWeight: '600', letterSpacing: '0.5px' }}>
                      {user.firstName || user.lastName 
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim().toUpperCase()
                        : 'NULL_ID'}
                    </div>
                  </div>
                </td>
                <td style={cellStyle}>
                  <span style={{ opacity: 0.8 }}>{user.email || 'NO_ADDR'}</span>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onRoleChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.role === 'admin' ? `${theme.colors.danger}15` : 'transparent',
                      color: user.role === 'admin' ? theme.colors.danger : theme.colors.text,
                      border: `1px solid ${user.role === 'admin' ? theme.colors.danger : theme.colors.borderStrong}`,
                      borderRadius: '2px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '11px',
                      fontWeight: '700',
                      fontFamily: theme.fonts.mono,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  >
                    <option value="user">USER_NODE</option>
                    <option value="admin">ROOT_ADMIN</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <select
                    value={user.dashboardAccess || 'demo'}
                    onChange={(e) => onAccessChange(user.id, e.target.value, user.firstName || user.email)}
                    disabled={loading}
                    style={{
                      background: user.dashboardAccess === 'real' ? `${theme.colors.warning}15` : 'transparent',
                      color: user.dashboardAccess === 'real' ? theme.colors.warning : theme.colors.textMuted,
                      border: `1px solid ${user.dashboardAccess === 'real' ? theme.colors.warning : theme.colors.borderStrong}`,
                      borderRadius: '2px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '11px',
                      fontWeight: '700',
                      fontFamily: theme.fonts.mono,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  >
                    <option value="demo">SANDBOX_DS</option>
                    <option value="real">PROD_LIVE</option>
                  </select>
                </td>
                <td style={cellStyle}>
                  <span style={{ fontSize: '11px', opacity: 0.6 }}>
                    {formatDateDDMMYYYY(user.createdAt, '00.00.0000')}
                  </span>
                </td>
                <td style={cellStyle}>
                  <span style={{ fontSize: '11px', color: theme.colors.success, opacity: 0.8 }}>
                    {formatDateDDMMYYYY(user.lastSignInAt, 'NEVER_SYNCED')}
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
