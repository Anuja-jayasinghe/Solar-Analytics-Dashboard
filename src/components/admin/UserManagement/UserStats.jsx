import React from 'react';
import SkeletonLoader from '../../shared/SkeletonLoader';

export default function UserStats({ users, loading }) {
  if (loading) {
    return <SkeletonLoader variant="stats" />;
  }

  const admins = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role !== 'admin');
  const realAccessUsers = users.filter(u => u.dashboardAccess === 'real');
  const demoAccessUsers = users.filter(u => u.dashboardAccess === 'demo');

  const stats = [
    { label: 'Total Users', value: users.length, color: 'var(--accent)' },
    { label: 'Admins', value: admins.length, color: 'var(--error-color)' },
    { label: 'Regular Users', value: regularUsers.length, color: 'var(--success-color)' },
    { label: 'Real Access', value: realAccessUsers.length, color: 'var(--warning-color)' },
    { label: 'Demo Access', value: demoAccessUsers.length, color: 'var(--text-muted)' }
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
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.25rem'
          }}
        >
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            {stat.label}
          </div>

          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            color: stat.color
          }}>
            {stat.value}
          </div>

          <div style={{
            marginTop: '0.8rem',
            height: '4px',
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '2px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.min((stat.value / (users.length || 1)) * 100, 100)}%`,
              background: stat.color,
              borderRadius: '2px'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
