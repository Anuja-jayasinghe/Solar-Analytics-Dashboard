import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';

export default function UserAccessManagement() {
  const { user: clerkUser } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch all users from Clerk
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Call your backend API to get users from Clerk
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${await clerkUser?.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
      // For now, use mock data in development
      setUsers(getMockUsers());
    } finally {
      setLoading(false);
    }
  };

  // Mock data for development
  const getMockUsers = () => {
    return [
      {
        id: '1',
        email: 'user1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        dashboardAccess: 'demo',
        createdAt: new Date('2024-01-15').toISOString()
      },
      {
        id: '2',
        email: 'user2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
        dashboardAccess: 'real',
        createdAt: new Date('2024-02-20').toISOString()
      },
      {
        id: '3',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        dashboardAccess: 'real',
        createdAt: new Date('2023-12-01').toISOString()
      }
    ];
  };

  const updateUserAccess = async (userId, newAccess) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await clerkUser?.getToken()}`
        },
        body: JSON.stringify({ dashboardAccess: newAccess })
      });

      if (!response.ok) {
        throw new Error('Failed to update user access');
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, dashboardAccess: newAccess } : u
      ));
      
      setSuccessMessage(`Access updated successfully for user`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating access:', err);
      alert('Failed to update user access. This feature requires backend API setup.');
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await clerkUser?.getToken()}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      
      setSuccessMessage(`Role updated successfully for user`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update user role. This feature requires backend API setup.');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    realAccess: users.filter(u => u.dashboardAccess === 'real').length,
    demoAccess: users.filter(u => u.dashboardAccess === 'demo').length
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-primary)' }}>
        Loading users...
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0' }}>
          👥 User Access Management
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
          Manage user roles and dashboard access levels
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          padding: '12px',
          background: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '14px'
        }}>
          ✅ {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px',
          background: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Total Users', value: stats.total, color: '#007bff' },
          { label: 'Admins', value: stats.admins, color: '#dc3545' },
          { label: 'Real Access', value: stats.realAccess, color: '#28a745' },
          { label: 'Demo Access', value: stats.demoAccess, color: '#ffc107' }
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'var(--card-bg)',
            padding: '1rem',
            borderRadius: '8px',
            border: `2px solid ${stat.color}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="🔍 Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Users Table */}
      <div style={{ 
        background: 'var(--card-bg)', 
        borderRadius: '8px', 
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ background: 'rgba(255, 122, 0, 0.1)' }}>
              <th style={tableHeaderStyle}>Email</th>
              <th style={tableHeaderStyle}>Name</th>
              <th style={tableHeaderStyle}>Role</th>
              <th style={tableHeaderStyle}>Dashboard Access</th>
              <th style={tableHeaderStyle}>Joined</th>
              <th style={tableHeaderStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: 'var(--text-secondary)' 
                }}>
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: '500' }}>{user.email}</div>
                  </td>
                  <td style={tableCellStyle}>
                    {user.firstName || user.lastName ? 
                      `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
                      '-'
                    }
                  </td>
                  <td style={tableCellStyle}>
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        background: user.role === 'admin' ? '#dc3545' : 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={tableCellStyle}>
                    <select
                      value={user.dashboardAccess}
                      onChange={(e) => updateUserAccess(user.id, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        background: user.dashboardAccess === 'real' ? '#28a745' : '#ffc107',
                        color: user.dashboardAccess === 'real' ? 'white' : '#000',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      <option value="demo">Demo</option>
                      <option value="real">Real</option>
                    </select>
                  </td>
                  <td style={tableCellStyle}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={tableCellStyle}>
                    <button
                      onClick={() => {
                        if (confirm(`View details for ${user.email}?`)) {
                          alert('User details view coming soon!');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Note */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(0, 122, 255, 0.1)',
        border: '1px solid rgba(0, 122, 255, 0.3)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--text-secondary)'
      }}>
        <strong style={{ color: 'var(--accent)' }}>🔐 Clerk Integration:</strong> This system uses Clerk's 
        <code>publicMetadata</code> to manage user roles and access levels. No Supabase required! 
        Changes are stored directly in Clerk and reflected immediately after user re-login.
        <br/><br/>
        <strong>Setup:</strong> Deploy the API endpoints (<code>/api/admin/users</code>) to enable live management. 
        Currently showing mock data for demonstration.
      </div>
    </div>
  );
}

const tableHeaderStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  color: 'var(--accent)',
  fontWeight: '600',
  borderBottom: '2px solid var(--border-color)'
};

const tableCellStyle = {
  padding: '12px 16px',
  color: 'var(--text-primary)'
};
