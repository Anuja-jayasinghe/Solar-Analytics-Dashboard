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
