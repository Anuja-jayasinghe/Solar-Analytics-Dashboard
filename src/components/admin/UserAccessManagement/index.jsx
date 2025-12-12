import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import useTablePagination from '../../../hooks/useTablePagination';
import { applyAllFilters, getAdminStats } from '../../../lib/adminPagination';
import SkeletonLoader from '../../shared/SkeletonLoader';
import ConfirmDialog from '../../shared/ConfirmDialog';
import UserFilters from './UserFilters';
import UserTable from './UserTable';
import BulkOperations from './BulkOperations';

/**
 * User Access Management Component
 * Manages user dashboard access levels (demo/real)
 * Allows filtering, searching, and bulk operations
 */
export default function UserAccessManagement() {
  const { getToken } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterAccess, setFilterAccess] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, userIds: [], newValue: null });

  // Pagination hook
  const {
    currentPage,
    itemsPerPage,
    paginate,
    setItemsPerPage,
    paginatedData,
    totalItems
  } = useTablePagination(
    applyAllFilters(allUsers, searchQuery, filterRole, filterAccess),
    20
  );

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

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
      const token = await getToken();
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);

      const data = await response.json();
      setAllUsers(data.users || []);
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

      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, dashboardAccess: newAccess } : u));
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
    } catch (err) {
      setError(`Failed to update access: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = (newAccess) => {
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

      setAllUsers(allUsers.map(u =>
        userIds.includes(u.id) ? { ...u, dashboardAccess: newValue } : u
      ));
      setSelectedUsers(new Set());
      setSuccessMessage(`Updated ${userIds.length} user(s) to ${newValue} access`);
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
    if (selectedUsers.size === paginatedData.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedData.map(u => u.id)));
    }
  };

  // Calculate stats
  const stats = getAdminStats(allUsers);

  if (loading && allUsers.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 1rem 0' }}>👥 User Access Management</h2>
        <SkeletonLoader count={5} variant="user" />
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

      {/* Filters Component */}
      <UserFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterRole={filterRole}
        onRoleChange={setFilterRole}
        filterAccess={filterAccess}
        onAccessChange={setFilterAccess}
      />

      {/* Bulk Operations Component */}
      {selectedUsers.size > 0 && (
        <BulkOperations
          selectedCount={selectedUsers.size}
          onGrantRealAccess={() => handleBulkUpdate('real')}
          onSetDemo={() => handleBulkUpdate('demo')}
          loading={loading}
        />
      )}

      {/* User Table Component */}
      <UserTable
        users={paginatedData}
        selectedUsers={selectedUsers}
        onToggleSelect={toggleUserSelection}
        onSelectAll={selectAll}
        onAccessChange={handleAccessChange}
        loading={loading}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        onPageChange={paginate}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title="Confirm Bulk Update"
        message={`Update ${confirmDialog.userIds.length} user(s) to ${confirmDialog.newValue} access?`}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={confirmBulkUpdate}
        onCancel={() => setConfirmDialog({ open: false, action: null, userIds: [], newValue: null })}
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
