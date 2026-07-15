import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import UserTable from './UserTable';
import UserStats from './UserStats';
import SearchBar from './SearchBar';
import BulkOperations from './BulkOperations';
import ConfirmDialog from '../../shared/ConfirmDialog';
import SkeletonLoader from '../../shared/SkeletonLoader';
import { useToast } from '../../shared/ToastManager';

/**
 * Unified User Management Component
 * Manages both user roles and dashboard access in one place
 */
export default function UserManagement() {
  const { getToken } = useAuth();
  const toast = useToast();
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
    newValue: null
  });
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkTargetAccess, setBulkTargetAccess] = useState(null);

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

  // Get an auth token that backend can verify
  const fetchAuthToken = async () => {
    const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME;
    if (template) {
      const token = await getToken({ template });
      if (token) return token;
    }
    return await getToken();
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await safeReadBody(response);
        toast.error(`Failed to fetch users (${response.status})`);
        throw new Error(`Failed to fetch users: ${response.status} ${JSON.stringify(body)}`);
      }

      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole, userName) => {
    setConfirmDialog({
      open: true,
      action: 'role',
      userId,
      userName,
      newValue: newRole
    });
  };

  const handleAccessChange = (userId, newAccess, userName) => {
    setConfirmDialog({
      open: true,
      action: 'access',
      userId,
      userName,
      newValue: newAccess
    });
  };

  const confirmChange = async () => {
    const { userId, action, newValue } = confirmDialog;
    setConfirmDialog({ open: false, action: null, userId: null, userName: null, newValue: null });
    setLoading(true);
    setError('');

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');

      const body = action === 'role' 
        ? { role: newValue }
        : { dashboardAccess: newValue };

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const responseBody = await safeReadBody(response);
        toast.error(`Update failed (${response.status})`);
        throw new Error(`Failed to update: ${response.status} ${JSON.stringify(responseBody)}`);
      }

      setSuccessMessage(
        action === 'role'
          ? `User ${newValue === 'admin' ? 'promoted to admin' : 'demoted to user'}`
          : `Dashboard access updated to ${newValue}`
      );
      toast.success(action === 'role' ? 'Role updated' : 'Access updated');
      fetchUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      setError(`Failed to update user. ${err.message}`);
      toast.error('Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllUsers = () => {
    setSelectedUsers((prev) =>
      prev.size === filteredUsers.length ? new Set() : new Set(filteredUsers.map((u) => u.id))
    );
  };

  const requestBulkAccessChange = (newAccess) => {
    if (selectedUsers.size === 0) return;
    setBulkTargetAccess(newAccess);
    setBulkConfirmOpen(true);
  };

  const confirmBulkAccessChange = async () => {
    setBulkConfirmOpen(false);
    setLoading(true);
    setError('');
    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error('No auth token');

      const userIds = Array.from(selectedUsers);
      const responses = await Promise.all(
        userIds.map((userId) =>
          fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dashboardAccess: bulkTargetAccess })
          })
        )
      );

      if (!responses.every((r) => r.ok)) throw new Error('Some updates failed');

      setSuccessMessage(`Updated ${userIds.length} user(s) to ${bulkTargetAccess} access`);
      toast.success(`${userIds.length} user(s) updated`);
      setSelectedUsers(new Set());
      fetchUsers();
    } catch (err) {
      console.error('Bulk update error:', err);
      setError(`Bulk update failed: ${err.message}`);
      toast.error('Bulk update failed');
    } finally {
      setLoading(false);
      setBulkTargetAccess(null);
    }
  };

  const filteredUsers = allUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query) ||
      user.dashboardAccess?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="admin-section">
      {/* Header */}
      <div className="admin-section-header">
        <h2 className="admin-section-title">👥 User Management</h2>
        <p className="admin-section-subtitle">Manage user roles and dashboard access</p>
      </div>

      {/* Stats */}
      <UserStats users={allUsers} loading={loading && allUsers.length === 0} />

      {/* Search */}
      <SearchBar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        resultCount={filteredUsers.length}
        totalCount={allUsers.length}
      />

      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <span style={{ fontWeight: 500 }}>{successMessage}</span>
        </div>
      )}

      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: '#fff',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
        }}>
          <span style={{ fontSize: '20px' }}>❌</span>
          <span style={{ fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {selectedUsers.size > 0 && (
        <BulkOperations
          selectedCount={selectedUsers.size}
          onGrantRealAccess={() => requestBulkAccessChange('real')}
          onSetDemo={() => requestBulkAccessChange('demo')}
          loading={loading}
        />
      )}

      {/* User Table */}
      {loading && allUsers.length === 0 ? (
        <SkeletonLoader count={8} variant="table" />
      ) : (
        <UserTable
          users={filteredUsers}
          loading={loading}
          onRoleChange={handleRoleChange}
          onAccessChange={handleAccessChange}
          selectedUsers={selectedUsers}
          onToggleSelect={toggleUserSelection}
          onSelectAll={selectAllUsers}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.action === 'role' ? 'Confirm Role Change' : 'Confirm Access Change'}
        message={
          confirmDialog.action === 'role'
            ? `Are you sure you want to ${confirmDialog.newValue === 'admin' ? 'promote' : 'demote'} ${confirmDialog.userName}?`
            : `Change dashboard access for ${confirmDialog.userName} to ${confirmDialog.newValue}?`
        }
        onConfirm={confirmChange}
        onCancel={() => setConfirmDialog({ open: false, action: null, userId: null, userName: null, newValue: null })}
      />

      {/* Bulk Confirm Dialog */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Confirm Bulk Update"
        message={`Update ${selectedUsers.size} user(s) to ${bulkTargetAccess} access?`}
        onConfirm={confirmBulkAccessChange}
        onCancel={() => { setBulkConfirmOpen(false); setBulkTargetAccess(null); }}
        isLoading={loading}
        isDangerous={true}
      />
    </div>
  );
}

// Safely read JSON body; fallback to text
async function safeReadBody(response) {
  try {
    return await response.json();
  } catch (_e) {
    try {
      return await response.text();
    } catch (_err) {
      return 'Unable to read body';
    }
  }
}
