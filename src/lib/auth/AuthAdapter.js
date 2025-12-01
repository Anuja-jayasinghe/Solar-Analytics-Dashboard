/**
 * Auth Adapter Interface
 * Abstract authentication interface that can be implemented by different providers
 * Implementations: SupabaseAuthAdapter, ClerkAuthAdapter
 */

export class AuthAdapter {
  /**
   * Get the current authenticated user
   * @returns {Promise<User|null>} User object or null if not authenticated
   */
  async getCurrentUser() {
    throw new Error('getCurrentUser() not implemented');
  }

  /**
   * Get the current session
   * @returns {Promise<Session|null>} Session object or null
   */
  async getSession() {
    throw new Error('getSession() not implemented');
  }

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: User, session: Session, error: Error|null}>}
   */
  async signIn(email, password) {
    throw new Error('signIn() not implemented');
  }

  /**
   * Sign up with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: User, session: Session, error: Error|null}>}
   */
  async signUp(email, password) {
    throw new Error('signUp() not implemented');
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    throw new Error('signOut() not implemented');
  }

  /**
   * Check if a user is an admin
   * @param {User} user
   * @returns {Promise<boolean>}
   */
  async checkIsAdmin(user) {
    throw new Error('checkIsAdmin() not implemented');
  }

  /**
   * Check if a user has real dashboard access
   * @param {User} user
   * @returns {Promise<boolean>}
   */
  async hasRealAccess(user) {
    throw new Error('hasRealAccess() not implemented');
  }

  /**
   * Refresh the current session
   * @returns {Promise<Session|null>}
   */
  async refreshSession() {
    throw new Error('refreshSession() not implemented');
  }

  /**
   * Subscribe to auth state changes
   * @param {function} callback - Called when auth state changes (event, session)
   * @returns {function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    throw new Error('onAuthStateChange() not implemented');
  }

  /**
   * Get the user's role
   * @param {User} user
   * @returns {Promise<string>} "admin" | "user"
   */
  async getUserRole(user) {
    throw new Error('getUserRole() not implemented');
  }

  /**
   * Get the user's dashboard access level
   * @param {User} user
   * @returns {Promise<string>} "real" | "demo"
   */
  async getDashboardAccess(user) {
    throw new Error('getDashboardAccess() not implemented');
  }

  /**
   * Update user metadata (admin only)
   * @param {string} userId
   * @param {object} metadata
   * @returns {Promise<void>}
   */
  async updateUserMetadata(userId, metadata) {
    throw new Error('updateUserMetadata() not implemented');
  }

  /**
   * Get authentication token for API calls
   * @returns {Promise<string|null>}
   */
  async getToken() {
    throw new Error('getToken() not implemented');
  }
}

/**
 * User type definition (common across providers)
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {boolean} emailVerified
 * @property {object} metadata
 * @property {string} createdAt
 */

/**
 * Session type definition (common across providers)
 * @typedef {Object} Session
 * @property {string} id
 * @property {User} user
 * @property {string} expiresAt
 * @property {string} token
 */
