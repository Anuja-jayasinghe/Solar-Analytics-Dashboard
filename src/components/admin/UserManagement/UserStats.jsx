import React, { useContext } from 'react';
import { AdminThemeContext } from '../../../contexts/AdminThemeContext';
import { getAdminTheme } from '../adminTheme';
import SkeletonLoader from '../../shared/SkeletonLoader';

export default function UserStats({ users, loading }) {
  const { selectedTheme, adminColorPresets } = useContext(AdminThemeContext);
  const theme = getAdminTheme(adminColorPresets[selectedTheme]);

  if (loading) {
    return <SkeletonLoader variant="stats" />;
  }

  const admins = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role !== 'admin');
  const realAccessUsers = users.filter(u => u.dashboardAccess === 'real');
  const demoAccessUsers = users.filter(u => u.dashboardAccess === 'demo');

  const stats = [
    { label: 'ALL_USERS', value: users.length, icon: 'Users', color: theme.colors.accent },
    { label: 'SUPER_ADMINS', value: admins.length, icon: 'Shield', color: theme.colors.danger },
    { label: 'STANDARD_USER', value: regularUsers.length, icon: 'User', color: theme.colors.success },
    { label: 'SECURE_REAL', value: realAccessUsers.length, icon: 'Lock', color: theme.colors.warning },
    { label: 'SANDBOX_DEMO', value: demoAccessUsers.length, icon: 'Code', color: theme.colors.textMuted }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      {stats.map((stat, index) => (
        <div
          key={index}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '2px',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Diagnostic Corner */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: '2px 4px',
            fontSize: '8px',
            fontFamily: theme.fonts.mono,
            color: theme.colors.accent,
            opacity: 0.5,
            borderBottom: `1px solid ${theme.colors.border}`,
            borderLeft: `1px solid ${theme.colors.border}`
          }}>
            0x0{index + 1}
          </div>

          <div style={{
            fontFamily: theme.fonts.mono,
            fontSize: '10px',
            color: theme.colors.textMuted,
            letterSpacing: '1px',
            marginBottom: '0.5rem',
            textTransform: 'uppercase'
          }}>
            {stat.label}
          </div>
          
          <div style={{
            fontFamily: theme.fonts.mono,
            fontSize: '28px',
            fontWeight: '700',
            color: stat.color,
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.4rem'
          }}>
            {stat.value.toString().padStart(2, '0')}
            <span style={{ fontSize: '10px', opacity: 0.4, fontWeight: 'normal' }}>UNIT_CNT</span>
          </div>

          <div style={{
            marginTop: '0.8rem',
            height: '2px',
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min((stat.value / (users.length || 1)) * 100, 100)}%`,
              background: stat.color,
              boxShadow: `0 0 8px ${stat.color}80`
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
