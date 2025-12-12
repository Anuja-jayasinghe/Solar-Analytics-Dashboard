/**
 * Admin Pagination Utilities
 * Helper functions for pagination, filtering, and sorting
 */

/**
 * Filter users by search query (email, name)
 */
export const filterUsersBySearch = (users, query) => {
  if (!query || query.trim() === '') return users;
  
  const lowerQuery = query.toLowerCase();
  return users.filter(user =>
    user.email?.toLowerCase().includes(lowerQuery) ||
    user.firstName?.toLowerCase().includes(lowerQuery) ||
    user.lastName?.toLowerCase().includes(lowerQuery) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Filter users by role
 */
export const filterUsersByRole = (users, role) => {
  if (role === 'all') return users;
  return users.filter(user => user.role === role);
};

/**
 * Filter users by dashboard access level
 */
export const filterUsersByAccess = (users, access) => {
  if (access === 'all') return users;
  return users.filter(user => user.dashboardAccess === access);
};

/**
 * Apply all filters at once
 */
export const applyAllFilters = (users, searchQuery, roleFilter, accessFilter) => {
  let filtered = users;
  
  if (searchQuery) {
    filtered = filterUsersBySearch(filtered, searchQuery);
  }
  
  if (roleFilter && roleFilter !== 'all') {
    filtered = filterUsersByRole(filtered, roleFilter);
  }
  
  if (accessFilter && accessFilter !== 'all') {
    filtered = filterUsersByAccess(filtered, accessFilter);
  }
  
  return filtered;
};

/**
 * Sort users by field
 */
export const sortUsers = (users, field, order = 'asc') => {
  const sorted = [...users];
  
  sorted.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];
    
    if (typeof valA === 'string') {
      valA = valA?.toLowerCase() || '';
      valB = valB?.toLowerCase() || '';
    }
    
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
};

/**
 * Get statistics from users array
 */
export const getAdminStats = (users) => {
  return {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    regularUsers: users.filter(u => u.role !== 'admin').length,
    realAccess: users.filter(u => u.dashboardAccess === 'real').length,
    demoAccess: users.filter(u => u.dashboardAccess === 'demo').length,
  };
};

/**
 * Get user full name
 */
export const getUserFullName = (user) => {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || user.email || 'Unknown';
};

/**
 * Format user role for display
 */
export const formatRole = (role) => {
  const roleMap = {
    admin: '👨‍💼 Admin',
    user: '👤 User',
  };
  return roleMap[role] || role;
};

/**
 * Format access level for display
 */
export const formatAccess = (access) => {
  const accessMap = {
    real: '🔓 Real Data',
    demo: '🔒 Demo Only',
  };
  return accessMap[access] || access;
};
