import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

/**
 * Admin Management Component
 * Manages admin roles using Clerk API
 * Allows admins to promote/demote users to/from admin role
 */
export default function AdminManagement() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, userId: null, userName: null });

  // Fetch users on mount
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

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      setUsers(data.users || []);
      const adminUsers = (data.users || []).filter(u => u.role === 'admin');
      setAdmins(adminUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    const action = newRole === 'admin' ? 'promote' : 'demote';
    const actionText = newRole === 'admin' ? 'promote to admin' : 'remove admin role';

    setConfirmDialog({
      open: true,
      action,
      userId,
      userName,
      actionText
    });
  };

  const confirmRoleChange = async () => {
    const { userId, action } = confirmDialog;
    setConfirmDialog({ open: false, action: null, userId: null, userName: null });
    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      const newRole = action === 'promote' ? 'admin' : 'user';

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      setSuccessMessage(`User ${action === 'promote' ? 'promoted to' : 'removed from'} admin role successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      setError(`Failed to ${confirmDialog.actionText}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (admin.firstName && admin.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (admin.lastName && admin.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const nonAdminUsers = users.filter(u => u.role !== 'admin').filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-color)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 0.5rem 0', fontSize: '28px' }}>
          🔐 Admin Role Management
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
          Promote users to admin or remove admin privileges
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <StatCard label="Total Users" value={users.length} color="#007bff" />
        <StatCard label="Admins" value={admins.length} color="#dc3545" />
        <StatCard label="Regular Users" value={users.length - admins.length} color="#28a745" />
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

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="🔍 Search users by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Admin Users Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '20px', margin: '0 0 1rem 0' }}>
          👑 Current Admins ({filteredAdmins.length})
        </h3>
        {filteredAdmins.length === 0 ? (
          <div style={{
            padding: '2rem',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            {searchQuery ? 'No admins match your search' : 'No admin users found'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '0.75rem'
          }}>
            {filteredAdmins.map(admin => (
              <UserRow
                key={admin.id}
                user={admin}
                role="admin"
                onRoleChange={() => handleRoleChange(admin.id, 'user', `${admin.firstName} ${admin.lastName}`)}
                buttonLabel="Demote from Admin"
                buttonColor="#ffc107"
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Regular Users Section */}
      <div>
        <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '20px', margin: '0 0 1rem 0' }}>
          👤 Regular Users ({nonAdminUsers.length})
        </h3>
        {nonAdminUsers.length === 0 ? (
          <div style={{
            padding: '2rem',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            {searchQuery ? 'No users match your search' : 'All users are admins'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '0.75rem'
          }}>
            {nonAdminUsers.map(user => (
              <UserRow
                key={user.id}
                user={user}
                role="user"
                onRoleChange={() => handleRoleChange(user.id, 'admin', `${user.firstName} ${user.lastName}`)}
                buttonLabel="Promote to Admin"
                buttonColor="#28a745"
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ color: 'var(--accent)', marginTop: 0, marginBottom: '1rem' }}>
              Confirm {confirmDialog.action === 'promote' ? 'Promotion' : 'Demotion'}
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Are you sure you want to {confirmDialog.actionText} for <strong>{confirmDialog.userName}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setConfirmDialog({ open: false, action: null, userId: null, userName: null })}
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
                onClick={confirmRoleChange}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: confirmDialog.action === 'promote' ? '#28a745' : '#ffc107',
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
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '1.25rem',
      borderRadius: '8px',
      border: `2px solid ${color}`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        {label}
      </div>
    </div>
  );
}

// User Row Component
function UserRow({ user, role, onRoleChange, buttonLabel, buttonColor, loading }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      padding: '1rem',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: `1px solid var(--border-color)`,
      transition: 'all 0.2s ease'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {user.email}
        </div>
        <div style={{
          fontSize: '12px',
          marginTop: '0.5rem',
          display: 'inline-block',
          padding: '4px 8px',
          background: role === 'admin' ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)',
          color: role === 'admin' ? '#dc3545' : '#28a745',
          borderRadius: '4px'
        }}>
          {role === 'admin' ? '👑 Admin' : '👤 Regular User'}
        </div>
      </div>
      <button
        onClick={onRoleChange}
        disabled={loading}
        style={{
          padding: '8px 16px',
          background: buttonColor,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          opacity: loading ? 0.6 : 1,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          marginLeft: '1rem'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.target.style.opacity = '0.8';
            e.target.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
          }
        }}
      >
        {loading ? '⏳' : buttonLabel}
      </button>
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
