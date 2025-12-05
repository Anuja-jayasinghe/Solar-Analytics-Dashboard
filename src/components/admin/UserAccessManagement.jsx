import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function UserAccessManagement() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterAccess, setFilterAccess] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Fetch all users from Clerk
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    // Check if we're in pure development mode (Vite dev server without API proxy)
    // Vercel dev runs on port 3000, Vite dev runs on port 5173
    const isViteDevMode = window.location.port === '5173';
    
    if (isViteDevMode) {
      console.warn('🧪 Vite dev mode detected - using mock data');
      console.warn('💡 To use real API: Run `vercel dev` (port 3000) or deploy to production');
      setUsers(getMockUsers());
      setLoading(false);
      return;
    }
    
    // Check if Clerk user is available
    if (!clerkUser) {
      setError('⚠️ Clerk user not loaded. Please refresh the page.');
      setUsers(getMockUsers());
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching users from API...');
      const token = await getToken();
      console.log('🔑 Token obtained:', token ? 'Yes' : 'No');
      
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📡 API Response Status:', response.status);
      
      if (response.status === 401) {
        setError('You are not logged in. Please log in again.');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      if (response.status === 403) {
        setError('You are not authorized to view this page.');
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || `API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Users fetched:', data.users?.length || 0);
      
      setUsers(data.users || []);
      
      // Show warning if no users returned
      if (!data.users || data.users.length === 0) {
        setError('⚠️ No users found. This might indicate an API issue or empty user list.');
      }
    } catch (err) {
      console.error('❌ Error fetching users:', err);
      setError(`API Error: ${err.message}. Using mock data for demo.`);
      // Use mock data as fallback
      setUsers(getMockUsers());
    } finally {
      setLoading(false);
    }
  };

  // Mock data for development
  const getMockUsers = () => {
    console.warn('⚠️ Using MOCK DATA - API not connected');
    return [
      {
        id: 'mock-1',
        email: 'user1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        dashboardAccess: 'demo',
        createdAt: new Date('2024-01-15').toISOString(),
        isMock: true
      },
      {
        id: 'mock-2',
        email: 'user2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
        dashboardAccess: 'real',
        createdAt: new Date('2024-02-20').toISOString(),
        isMock: true
      },
      {
        id: 'mock-3',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        dashboardAccess: 'real',
        createdAt: new Date('2023-12-01').toISOString(),
        isMock: true
      }
    ];
  };

  const updateUserAccess = async (userId, newAccess) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`
        },
        body: JSON.stringify({ dashboardAccess: newAccess })
      });
      if (response.status === 401) {
        setError('You are not logged in. Please log in again.');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      if (response.status === 403) {
        setError('You are not authorized to perform this action.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to update user access');
      }
      setUsers(users.map(u => u.id === userId ? { ...u, dashboardAccess: newAccess } : u));
      setSuccessMessage(`Access updated successfully for user`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating access:', err);
      setError('Failed to update user access.');
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.status === 401) {
        setError('You are not logged in. Please log in again.');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      if (response.status === 403) {
        setError('You are not authorized to perform this action.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to update user role');
      }
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setSuccessMessage(`Role updated successfully for user`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update user role.');
    }
  };

  const deleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to delete user: ${userEmail}?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        }
      });
      
      if (response.status === 401) {
        setError('You are not logged in. Please log in again.');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      if (response.status === 403) {
        setError('You are not authorized to perform this action.');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      setUsers(users.filter(u => u.id !== userId));
      setSuccessMessage(`User ${userEmail} deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user.');
    }
  };

  const bulkUpdateAccess = async (newAccess) => {
    if (selectedUsers.length === 0) {
      setError('Please select users first');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!confirm(`Update ${selectedUsers.length} user(s) to ${newAccess} access?`)) {
      return;
    }

    setLoading(true);
    const promises = selectedUsers.map(userId => updateUserAccess(userId, newAccess));
    await Promise.all(promises);
    setSelectedUsers([]);
    setLoading(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesAccess = filterAccess === 'all' || user.dashboardAccess === filterAccess;
    
    return matchesSearch && matchesRole && matchesAccess;
  });

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

      {/* Mock Data Warning */}
      {users.length > 0 && users[0]?.isMock && (
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)',
          color: '#856404',
          border: '2px solid #ffd700',
          borderRadius: '12px',
          marginBottom: '1rem',
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(255, 215, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🧪</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '15px' }}>Local Development Mode</strong>
              <div style={{ marginTop: '8px', lineHeight: '1.6' }}>
                You're viewing <strong>mock data</strong> because API endpoints only work in production or with Vercel CLI.
              </div>
              <div style={{ 
                marginTop: '12px', 
                padding: '10px', 
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '6px',
                fontSize: '13px'
              }}>
                <strong>To use real data:</strong>
                <ul style={{ margin: '6px 0 0 20px', paddingLeft: 0 }}>
                  <li><strong>Option 1:</strong> Run <code style={{ 
                    background: 'rgba(0,0,0,0.1)', 
                    padding: '2px 6px', 
                    borderRadius: '4px'
                  }}>vercel dev</code> in terminal (requires Vercel CLI)</li>
                  <li><strong>Option 2:</strong> Deploy to production and test there</li>
                </ul>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.9 }}>
                💡 Changes made to mock users won't be saved
              </div>
            </div>
          </div>
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

      {/* Search and Filters */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr auto auto auto', 
        gap: '1rem', 
        marginBottom: '1rem',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '12px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px'
          }}
        />
        
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: '12px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Roles</option>
          <option value="user">Users Only</option>
          <option value="admin">Admins Only</option>
        </select>

        <select
          value={filterAccess}
          onChange={(e) => setFilterAccess(e.target.value)}
          style={{
            padding: '12px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Access</option>
          <option value="demo">Demo Only</option>
          <option value="real">Real Only</option>
        </select>

        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            padding: '12px 20px',
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: loading ? 0.5 : 1
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(0, 122, 255, 0.1)',
          border: '1px solid rgba(0, 122, 255, 0.3)',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {selectedUsers.length} user(s) selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => bulkUpdateAccess('demo')}
              style={{
                padding: '8px 16px',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Set Demo Access
            </button>
            <button
              onClick={() => bulkUpdateAccess('real')}
              style={{
                padding: '8px 16px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Set Real Access
            </button>
            <button
              onClick={() => setSelectedUsers([])}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

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
              <th style={{ ...tableHeaderStyle, width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(filteredUsers.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </th>
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
                <td colSpan="7" style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: 'var(--text-secondary)' 
                }}>
                  {searchQuery || filterRole !== 'all' || filterAccess !== 'all' 
                    ? 'No users match your filters' 
                    : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr 
                  key={user.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)',
                    background: selectedUsers.includes(user.id) ? 'rgba(255, 122, 0, 0.05)' : 'transparent'
                  }}
                >
                  <td style={tableCellStyle}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
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
                      disabled={user.id === clerkUser?.id}
                      style={{
                        padding: '6px 12px',
                        background: user.role === 'admin' ? '#dc3545' : 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: user.id === clerkUser?.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        opacity: user.id === clerkUser?.id ? 0.6 : 1
                      }}
                      title={user.id === clerkUser?.id ? 'Cannot change your own role' : ''}
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          alert(`User Details:\n\nEmail: ${user.email}\nName: ${user.firstName || ''} ${user.lastName || ''}\nRole: ${user.role}\nAccess: ${user.dashboardAccess}\nJoined: ${new Date(user.createdAt).toLocaleString()}\nLast Sign In: ${user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'Never'}`);
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
                        📋
                      </button>
                      {user.id !== clerkUser?.id && (
                        <button
                          onClick={() => deleteUser(user.id, user.email)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            color: '#dc3545',
                            border: '1px solid #dc3545',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                          title="Delete user"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Results Summary */}
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem 1rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          Showing <strong style={{ color: 'var(--accent)' }}>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
        </span>
        {(searchQuery || filterRole !== 'all' || filterAccess !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterRole('all');
              setFilterAccess('all');
            }}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Info Note */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(0, 122, 255, 0.1)',
        border: '1px solid rgba(0, 122, 255, 0.3)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: '1.6'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: 'var(--accent)' }}>🔐 Clerk Integration:</strong> This system uses Clerk's 
          <code style={{ 
            padding: '2px 6px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '4px',
            margin: '0 4px'
          }}>publicMetadata</code> to manage user roles and access levels.
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: 'var(--accent)' }}>⚡ Features:</strong>
        </div>
        <ul style={{ margin: '0.25rem 0 0.5rem 1.5rem', paddingLeft: 0 }}>
          <li>Update user roles (admin/user) and dashboard access (demo/real)</li>
          <li>Bulk actions for multiple users at once</li>
          <li>Filter and search users by email, name, role, or access level</li>
          <li>Delete users (cannot delete yourself)</li>
          <li>Changes are reflected immediately after user re-login</li>
        </ul>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '0.5rem' }}>
          <strong>Note:</strong> API endpoints are at <code style={{ 
            padding: '2px 6px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '4px',
            margin: '0 4px'
          }}>/api/admin/users</code> and require valid admin authentication.
        </div>
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
