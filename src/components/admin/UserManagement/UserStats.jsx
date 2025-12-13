import React from 'react';

export default function UserStats({ users }) {
  const admins = users.filter(u => u.role === 'admin');
  const regularUsers = users.filter(u => u.role !== 'admin');
  const realAccessUsers = users.filter(u => u.dashboardAccess === 'real');
  const demoAccessUsers = users.filter(u => u.dashboardAccess === 'demo');

  const stats = [
    { label: 'Total Users', value: users.length, icon: '👥', color: '#3b82f6' },
    { label: 'Admins', value: admins.length, icon: '🔑', color: '#8b5cf6' },
    { label: 'Regular Users', value: regularUsers.length, icon: '👤', color: '#10b981' },
    { label: 'Real Access', value: realAccessUsers.length, icon: '✅', color: '#f59e0b' },
    { label: 'Demo Access', value: demoAccessUsers.length, icon: '📊', color: '#6b7280' }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      {stats.map((stat, index) => (
        <div
          key={index}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 2px 8px var(--card-shadow)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 16px var(--card-shadow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--card-shadow)';
          }}
        >
          <div style={{
            fontSize: '32px',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${stat.color}20`,
            borderRadius: '10px'
          }}>
            {stat.icon}
          </div>
          <div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: stat.color,
              marginBottom: '2px'
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontWeight: '500'
            }}>
              {stat.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
