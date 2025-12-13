// src/lib/localAuth.js
// Local development Clerk mock for testing authentication without real Clerk endpoints
// This allows rapid iteration on admin dashboard without needing deployments

const IS_LOCAL_DEV = import.meta.env.MODE === 'development';

// Default mock user
const DEFAULT_MOCK_USER = {
  id: 'user_local_dev_' + Math.random().toString(36).substr(2, 9),
  primaryEmailAddress: { emailAddress: 'dev@example.com' },
  firstName: 'Dev',
  lastName: 'User',
  publicMetadata: {
    role: 'admin',
    dashboardAccess: 'real'
  }
};

/**
 * Initialize local auth from localStorage or create default
 */
export const initializeLocalAuth = () => {
  if (!IS_LOCAL_DEV) return null;

  const stored = localStorage.getItem('__LOCAL_AUTH__');
  if (!stored) {
    localStorage.setItem('__LOCAL_AUTH__', JSON.stringify({
      isSignedIn: true,
      user: DEFAULT_MOCK_USER,
      sessionId: 'local_dev_session'
    }));
  }
  return true;
};

/**
 * Get current local auth state
 */
export const getLocalAuthState = () => {
  if (!IS_LOCAL_DEV) return null;

  try {
    const auth = JSON.parse(localStorage.getItem('__LOCAL_AUTH__') || '{}');
    return {
      isSignedIn: auth.isSignedIn ?? true,
      user: auth.user ?? DEFAULT_MOCK_USER,
      sessionId: auth.sessionId ?? 'local_dev_session',
      isLoaded: true
    };
  } catch (e) {
    console.error('Failed to parse local auth state:', e);
    return {
      isSignedIn: true,
      user: DEFAULT_MOCK_USER,
      sessionId: 'local_dev_session',
      isLoaded: true
    };
  }
};

/**
 * Hook for using local auth in components
 */
export const useAuthLocal = () => {
  const state = getLocalAuthState();
  
  return {
    isSignedIn: state.isSignedIn,
    user: state.user,
    sessionId: state.sessionId,
    isLoaded: true,
    getToken: async () => {
      // Simulate async token retrieval
      return new Promise(resolve => {
        setTimeout(() => {
          resolve('local_dev_token_' + Date.now());
        }, 100);
      });
    },
    signOut: () => {
      console.log('Sign out called (local dev)');
      localStorage.removeItem('__LOCAL_AUTH__');
      window.dispatchEvent(new Event('local-auth-change'));
    }
  };
};

/**
 * Update mock user (used by Dev Tools Panel)
 */
export const mockClerkUser = (overrides = {}) => {
  if (!IS_LOCAL_DEV) {
    console.warn('mockClerkUser only works in development mode');
    return;
  }

  const currentState = JSON.parse(localStorage.getItem('__LOCAL_AUTH__') || '{}');
  const defaultUser = currentState.user || DEFAULT_MOCK_USER;

  const updatedUser = {
    ...defaultUser,
    ...overrides,
    publicMetadata: {
      ...defaultUser.publicMetadata,
      ...overrides.publicMetadata
    }
  };

  const newState = {
    ...currentState,
    user: updatedUser
  };

  localStorage.setItem('__LOCAL_AUTH__', JSON.stringify(newState));
  window.dispatchEvent(new Event('local-auth-change'));
};

/**
 * Set user role (admin/user)
 */
export const setLocalRole = (role) => {
  if (!['admin', 'user'].includes(role)) {
    console.warn(`Invalid role: ${role}. Must be 'admin' or 'user'`);
    return;
  }

  const currentState = JSON.parse(localStorage.getItem('__LOCAL_AUTH__') || '{}');
  const user = currentState.user || DEFAULT_MOCK_USER;

  mockClerkUser({
    publicMetadata: {
      ...user.publicMetadata,
      role
    }
  });

  console.log(`Local auth role set to: ${role}`);
};

/**
 * Set dashboard access level (real/demo)
 */
export const setLocalAccess = (access) => {
  if (!['real', 'demo'].includes(access)) {
    console.warn(`Invalid access: ${access}. Must be 'real' or 'demo'`);
    return;
  }

  const currentState = JSON.parse(localStorage.getItem('__LOCAL_AUTH__') || '{}');
  const user = currentState.user || DEFAULT_MOCK_USER;

  mockClerkUser({
    publicMetadata: {
      ...user.publicMetadata,
      dashboardAccess: access
    }
  });

  console.log(`Local auth access set to: ${access}`);
};

/**
 * Create a test user configuration
 */
export const createTestUser = (config = {}) => {
  const {
    email = 'test@example.com',
    firstName = 'Test',
    lastName = 'User',
    role = 'user',
    dashboardAccess = 'demo'
  } = config;

  const user = {
    id: 'user_test_' + Math.random().toString(36).substr(2, 9),
    primaryEmailAddress: { emailAddress: email },
    firstName,
    lastName,
    publicMetadata: {
      role,
      dashboardAccess
    }
  };

  mockClerkUser(user);
  return user;
};

/**
 * Pre-configured test users for quick testing
 */
export const TEST_USERS = {
  ADMIN_REAL: () => createTestUser({
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    dashboardAccess: 'real'
  }),
  
  USER_REAL: () => createTestUser({
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    dashboardAccess: 'real'
  }),

  USER_DEMO: () => createTestUser({
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user',
    dashboardAccess: 'demo'
  }),

  ADMIN_DEMO: () => createTestUser({
    email: 'admin-demo@example.com',
    firstName: 'Admin',
    lastName: 'Demo',
    role: 'admin',
    dashboardAccess: 'demo'
  })
};

/**
 * Clear all local auth data
 */
export const clearLocalAuth = () => {
  localStorage.removeItem('__LOCAL_AUTH__');
  window.dispatchEvent(new Event('local-auth-change'));
  console.log('Local auth cleared');
};

/**
 * Log current auth state (for debugging)
 */
export const debugLocalAuth = () => {
  if (!IS_LOCAL_DEV) {
    console.warn('Debug only available in development');
    return;
  }

  const state = getLocalAuthState();
  console.group('🔐 Local Auth Debug Info');
  console.log('Auth State:', state);
  console.log('User:', state.user);
  console.log('Metadata:', state.user?.publicMetadata);
  console.log('Is Admin:', state.user?.publicMetadata?.role === 'admin');
  console.log('Has Real Access:', state.user?.publicMetadata?.dashboardAccess === 'real');
  console.groupEnd();
};

// Export for console access in development
if (IS_LOCAL_DEV && typeof window !== 'undefined') {
  window.__LOCAL_AUTH__ = {
    state: getLocalAuthState,
    setRole: setLocalRole,
    setAccess: setLocalAccess,
    setUser: mockClerkUser,
    createTestUser,
    TEST_USERS,
    clear: clearLocalAuth,
    debug: debugLocalAuth
  };
  console.log('💡 Tip: Use window.__LOCAL_AUTH__ in console for quick testing');
  console.log('  window.__LOCAL_AUTH__.setRole("admin")');
  console.log('  window.__LOCAL_AUTH__.TEST_USERS.ADMIN_REAL()');
}
