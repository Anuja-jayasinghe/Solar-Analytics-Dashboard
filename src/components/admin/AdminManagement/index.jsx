import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import useTablePagination from '../../../hooks/useTablePagination';
import SkeletonLoader from '../../shared/SkeletonLoader';
import ConfirmDialog from '../../shared/ConfirmDialog';
import AdminSearch from './AdminSearch';
import AdminUsersList from './AdminUsersList';
import RegularUsersList from './RegularUsersList';

/**
 * Admin Management Component
 * Manages admin roles using Clerk API
 * Allows admins to promote/demote users to/from admin role
 */
export default function AdminManagement() {
  const { getToken } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
    userId: null,
    userName: null,
    actionText: null
  });

  // Pagination for admins
  const admins = allUsers.filter(u => u.role === 'admin');
  const filteredAdmins = admins.filter(filterBySearch);
  const adminsPagination = useTablePagination(filteredAdmins, 20);

  // Pagination for regular users
  const regularUsers = allUsers.filter(u => u.role !== 'admin');
  const filteredRegularUsers = regularUsers.filter(filterBySearch);
  const regularUsersPagination = useTablePagination(filteredRegularUsers, 20);

  function filterBySearch(user) {
    return (
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Get an auth token that backend can verify. Prefer template only if provided via env.
  const fetchAuthToken = async () => {
    const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME;
    if (template) {
      const token = await getToken({ template });
      if (token) return token;
    }
    return await getToken();
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      setAllUsers(data.users || []);
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
    setConfirmDialog({
      open: false,
      action: null,
      userId: null,
      userName: null,
      actionText: null
    });
    setLoading(true);
    setError('');

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');
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

      setSuccessMessage(
        `User ${action === 'promote' ? 'promoted to' : 'removed from'} admin role successfully`
      );
      fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      setError(`Failed to ${confirmDialog.actionText}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && allUsers.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 1rem 0' }}>🔐 Admin Role Management</h2>
        <SkeletonLoader count={5} variant="user" />
      </div>
    );
  }

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
        <StatCard label="Total Users" value={allUsers.length} color="#007bff" icon="👥" />
        <StatCard label="Admins" value={admins.length} color="#dc3545" icon="👑" />
        <StatCard label="Regular Users" value={regularUsers.length} color="#28a745" icon="👤" />
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

      {/* Search Component */}
      <AdminSearch searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {/* Admin Users Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '20px', margin: '0 0 1rem 0' }}>
          👑 Current Admins ({filteredAdmins.length})
        </h3>
        <AdminUsersList
          users={adminsPagination.paginatedData}
          currentPage={adminsPagination.currentPage}
          itemsPerPage={adminsPagination.itemsPerPage}
          totalItems={adminsPagination.totalItems}
          onPageChange={adminsPagination.paginate}
          onItemsPerPageChange={adminsPagination.setItemsPerPage}
          onRoleChange={handleRoleChange}
          loading={loading}
          emptyMessage={searchQuery ? 'No admins match your search' : 'No admin users found'}
        />
      </div>

      {/* Regular Users Section */}
      <div>
        <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '20px', margin: '0 0 1rem 0' }}>
          👤 Regular Users ({filteredRegularUsers.length})
        </h3>
        <RegularUsersList
          users={regularUsersPagination.paginatedData}
          currentPage={regularUsersPagination.currentPage}
          itemsPerPage={regularUsersPagination.itemsPerPage}
          totalItems={regularUsersPagination.totalItems}
          onPageChange={regularUsersPagination.paginate}
          onItemsPerPageChange={regularUsersPagination.setItemsPerPage}
          onRoleChange={handleRoleChange}
          loading={loading}
          emptyMessage={searchQuery ? 'No users match your search' : 'All users are admins'}
        />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.action === 'promote' ? 'Confirm Promotion' : 'Confirm Demotion'}
        message={`Are you sure you want to ${confirmDialog.actionText} for ${confirmDialog.userName}?`}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={confirmRoleChange}
        onCancel={() =>
          setConfirmDialog({
            open: false,
            action: null,
            userId: null,
            userName: null,
            actionText: null
          })
        }
        isLoading={loading}
        isDangerous={true}
      />
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
