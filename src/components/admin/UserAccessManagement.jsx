import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

/**
 * User Access Management Component
 * Manages user dashboard access levels (demo/real)
 * Allows filtering, searching, and bulk operations
 */
export default function UserAccessManagement() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterAccess, setFilterAccess] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, userIds: [], newValue: null });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateAccess = async (userId, newAccess) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dashboardAccess: newAccess })
      });

      if (!response.ok) throw new Error(`Failed to update access: ${response.status}`);

      setUsers(users.map(u => u.id === userId ? { ...u, dashboardAccess: newAccess } : u));
      return true;
    } catch (err) {
      console.error('Error updating access:', err);
      throw err;
    }
  };

  const handleAccessChange = async (userId, newAccess) => {
    setLoading(true);
    setError('');
    try {
      await updateAccess(userId, newAccess);
      setSuccessMessage(`Access updated to ${newAccess}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(`Failed to update access: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async (newAccess) => {
    if (selectedUsers.size === 0) {
      setError('Please select users first');
      return;
    }

    setConfirmDialog({
      open: true,
      action: 'bulk-update',
      userIds: Array.from(selectedUsers),
      newValue: newAccess
    });
  };

  const confirmBulkUpdate = async () => {
    const { userIds, newValue } = confirmDialog;
    setConfirmDialog({ open: false, action: null, userIds: [], newValue: null });

    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const promises = userIds.map(userId =>
        fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dashboardAccess: newValue })
        })
      );

      const results = await Promise.all(promises);
      if (!results.every(r => r.ok)) throw new Error('Some updates failed');

      setUsers(users.map(u =>
        userIds.includes(u.id) ? { ...u, dashboardAccess: newValue } : u
      ));
      setSelectedUsers(new Set());
      setSuccessMessage(`Updated ${userIds.length} user(s) to ${newValue} access`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(`Bulk update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesAccess = filterAccess === 'all' || user.dashboardAccess === filterAccess;

    return matchesSearch && matchesRole && matchesAccess;
  });

  // Calculate stats
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    realAccess: users.filter(u => u.dashboardAccess === 'real').length,
    demoAccess: users.filter(u => u.dashboardAccess === 'demo').length
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '24px', marginBottom: '1rem' }}>⏳</div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-color)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0', fontSize: '28px' }}>
          👥 User Access Management
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
          Manage user roles and dashboard access levels
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <StatCard label="Total Users" value={stats.total} color="#007bff" icon="👥" />
        <StatCard label="Admins" value={stats.admins} color="#dc3545" icon="👑" />
        <StatCard label="Real Access" value={stats.realAccess} color="#28a745" icon="✅" />
        <StatCard label="Demo Access" value={stats.demoAccess} color="#ffc107" icon="🧪" />
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{
          padding: '12px 16px',
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

      {error && (
        <div style={{
          padding: '12px 16px',
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

      {/* Filters Section */}
      <div style={{
        background: 'var(--card-bg)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg-solid)',
              color: 'var(--text-color)',
              fontSize: '14px'
            }}
          />

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg-solid)',
              color: 'var(--text-color)',
              fontSize: '14px'
            }}
          >
            <option value="all">👥 All Roles</option>
            <option value="user">👤 Regular Users</option>
            <option value="admin">👑 Admins</option>
          </select>

          {/* Access Filter */}
          <select
            value={filterAccess}
            onChange={(e) => setFilterAccess(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg-solid)',
              color: 'var(--text-color)',
              fontSize: '14px'
            }}
          >
            <option value="all">📊 All Access Levels</option>
            <option value="real">✅ Real Access</option>
            <option value="demo">🧪 Demo Access</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {selectedUsers.size} selected
            </span>
            <button
              onClick={() => handleBulkUpdate('real')}
              disabled={loading}
              style={{
                padding: '8px 14px',
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1
              }}
            >
              Grant Real Access
            </button>
            <button
              onClick={() => handleBulkUpdate('demo')}
              disabled={loading}
              style={{
                padding: '8px 14px',
                background: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1
              }}
            >
              Set to Demo
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div style={{
          padding: '2rem',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ margin: 0 }}>
            {searchQuery || filterRole !== 'all' || filterAccess !== 'all'
              ? 'No users match your filters'
              : 'No users found'}
          </p>
        </div>
      ) : (
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
              checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
              onChange={selectAll}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
              disabled={filteredUsers.length === 0}
            />
            <div>User</div>
            <div style={{ textAlign: 'center' }}>Role</div>
            <div style={{ textAlign: 'center' }}>Access</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {filteredUsers.map((user, idx) => (
            <UserRow
              key={user.id}
              user={user}
              isSelected={selectedUsers.has(user.id)}
              onToggleSelect={() => toggleUserSelection(user.id)}
              onAccessChange={handleAccessChange}
              loading={loading}
              isLast={idx === filteredUsers.length - 1}
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ color: 'var(--accent)', marginTop: 0, marginBottom: '1rem' }}>
              Confirm Bulk Update
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Update <strong>{confirmDialog.userIds.length}</strong> user(s) to <strong>{confirmDialog.newValue}</strong> access?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setConfirmDialog({ open: false, action: null, userIds: [], newValue: null })}
                style={{
                  padding: '8px 16px',
                  background: 'var(--hover-bg)',
                  color: 'var(--text-color)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkUpdate}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '1.25rem',
      borderRadius: '8px',
      border: `2px solid ${color}`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
        {label}
      </div>
    </div>
  );
}

// User Row Component
function UserRow({ user, isSelected, onToggleSelect, onAccessChange, loading, isLast }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr 100px 120px 120px',
      gap: '0',
      alignItems: 'center',
      padding: '1rem',
      borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      transition: 'background 0.2s ease',
      background: isSelected ? 'rgba(255, 122, 0, 0.1)' : 'transparent'
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

      {/* Actions */}
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
              opacity: loading ? 0.6 : 1
            }}
          >
            Demo
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
              opacity: loading ? 0.6 : 1
            }}
          >
            Real
          </button>
        )}
      </div>
    </div>
  );
}

// Styles
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 999
};

const modalStyle = {
  background: 'var(--card-bg)',
  backdropFilter: 'blur(10px)',
  padding: '2rem',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  maxWidth: '500px',
  width: '90%',
  color: 'var(--text-color)'
};

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
