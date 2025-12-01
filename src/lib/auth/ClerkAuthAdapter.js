/**
 * Clerk Auth Adapter
 * Implements authentication using Clerk
 */

import { AuthAdapter } from './AuthAdapter.js';

export class ClerkAuthAdapter extends AuthAdapter {
  constructor(clerkInstance, userHook, authHook) {
    super();
    // These will be injected from React context
    this.clerk = clerkInstance;
    this.useUser = userHook;
    this.useAuth = authHook;
  }

  async getCurrentUser() {
    const { user } = this.useUser();
    
    if (!user) return null;

    // Map Clerk user to common User format
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      emailVerified: user.primaryEmailAddress?.verification?.status === 'verified',
      metadata: {
        ...user.publicMetadata,
        ...user.unsafeMetadata
      },
      createdAt: new Date(user.createdAt).toISOString(),
      raw: user // Keep original Clerk user for advanced usage
    };
  }

  async getSession() {
    const { session } = this.clerk;
    
    if (!session) return null;

    return {
      id: session.id,
      user: await this.getCurrentUser(),
      expiresAt: new Date(session.expireAt).toISOString(),
      token: await session.getToken()
    };
  }

  async signIn(email, password) {
    try {
      const result = await this.clerk.client.signIn.create({
        identifier: email,
        password
      });

      if (result.status === 'complete') {
        await this.clerk.setActive({ session: result.createdSessionId });
        
        return {
          user: await this.getCurrentUser(),
          session: await this.getSession(),
          error: null
        };
      }

      return {
        user: null,
        session: null,
        error: new Error('Sign in incomplete')
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error
      };
    }
  }

  async signUp(email, password) {
    try {
      const result = await this.clerk.client.signUp.create({
        emailAddress: email,
        password
      });

      // Prepare email verification
      await result.prepareEmailAddressVerification({ strategy: 'email_code' });

      return {
        user: null, // User not fully created until verified
        session: null,
        error: null,
        requiresVerification: true
      };
    } catch (error) {
      return {
        user: null,
        session: null,
        error
      };
    }
  }

  async signOut() {
    const { signOut } = this.useAuth();
    await signOut();
    return { error: null };
  }

  async checkIsAdmin(user) {
    if (!user) return false;
    
    // Check publicMetadata.role
    const role = user.metadata?.role || user.raw?.publicMetadata?.role;
    return role === 'admin';
  }

  async hasRealAccess(user) {
    if (!user) return false;
    
    // Check publicMetadata.dashboardAccess
    const access = user.metadata?.dashboardAccess || user.raw?.publicMetadata?.dashboardAccess;
    return access === 'real';
  }

  async refreshSession() {
    // Clerk handles session refresh automatically
    // Just return current session
    return await this.getSession();
  }

  onAuthStateChange(callback) {
    // Clerk doesn't have a direct equivalent, but we can use session listeners
    const unsubscribe = this.clerk.addListener((event) => {
      if (event.type === 'session') {
        callback('session', event.session);
      } else if (event.type === 'user') {
        callback('user', event.session);
      }
    });

    return unsubscribe;
  }

  async getUserRole(user) {
    const isAdmin = await this.checkIsAdmin(user);
    return isAdmin ? 'admin' : 'user';
  }

  async getDashboardAccess(user) {
    const hasReal = await this.hasRealAccess(user);
    return hasReal ? 'real' : 'demo';
  }

  async updateUserMetadata(userId, metadata) {
    try {
      // This requires backend API call with Clerk secret key
      // Frontend can only update unsafeMetadata
      await this.clerk.user.update({
        unsafeMetadata: {
          ...this.clerk.user.unsafeMetadata,
          ...metadata
        }
      });
    } catch (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  async getToken() {
    const session = await this.getSession();
    return session?.token || null;
  }

  // Clerk-specific helpers

  /**
   * Update public metadata (requires backend call)
   * @param {string} userId
   * @param {object} metadata
   * @returns {Promise<void>}
   */
  async updatePublicMetadata(userId, metadata) {
    // This must be done via backend API
    const response = await fetch('/api/update-user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getToken()}`
      },
      body: JSON.stringify({ userId, metadata })
    });

    if (!response.ok) {
      throw new Error('Failed to update public metadata');
    }
  }

  /**
   * Grant real dashboard access to a user
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async grantRealAccess(userId) {
    await this.updatePublicMetadata(userId, {
      dashboardAccess: 'real',
      accessGrantedDate: new Date().toISOString()
    });
  }

  /**
   * Revoke real dashboard access (downgrade to demo)
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async revokeRealAccess(userId) {
    await this.updatePublicMetadata(userId, {
      dashboardAccess: 'demo',
      accessRevokedDate: new Date().toISOString()
    });
  }

  /**
   * Promote user to admin
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async promoteToAdmin(userId) {
    await this.updatePublicMetadata(userId, {
      role: 'admin',
      promotedToAdminDate: new Date().toISOString()
    });
  }

  /**
   * Demote admin to regular user
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async demoteFromAdmin(userId) {
    await this.updatePublicMetadata(userId, {
      role: 'user',
      demotedFromAdminDate: new Date().toISOString()
    });
  }
}
