/**
 * Supabase Auth Adapter
 * Wraps existing Supabase authentication logic
 */

import { AuthAdapter } from './AuthAdapter.js';
import { supabase } from '../supabaseClient.js';

export class SupabaseAuthAdapter extends AuthAdapter {
  constructor() {
    super();
    this.adminCache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
  }

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    return {
      user: data?.user || null,
      session: data?.session || null,
      error
    };
  }

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    return {
      user: data?.user || null,
      session: data?.session || null,
      error
    };
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    this.adminCache.clear();
    return { error };
  }

  async checkIsAdmin(user) {
    if (!user?.email) return false;

    const email = user.email.toLowerCase().trim();

    // Check cache first
    const cached = this.adminCache.get(email);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.isAdmin;
    }

    // Query admin_users table
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('email')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Admin check error:', error);
        // Return cached value if available, otherwise false
        return cached?.isAdmin || false;
      }

      const isAdmin = !!data;

      // Update cache
      this.adminCache.set(email, {
        isAdmin,
        timestamp: Date.now()
      });

      return isAdmin;
    } catch (error) {
      console.error('Admin check exception:', error);
      return cached?.isAdmin || false;
    }
  }

  async hasRealAccess(user) {
    // In Supabase, all authenticated users have real access
    // (unless they're specifically marked as demo in the future)
    return !!user;
  }

  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    return data?.session || null;
  }

  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );

    return () => subscription.unsubscribe();
  }

  async getUserRole(user) {
    const isAdmin = await this.checkIsAdmin(user);
    return isAdmin ? 'admin' : 'user';
  }

  async getDashboardAccess(user) {
    if (!user?.email) return 'demo';

    const email = user.email.toLowerCase().trim();

    // Check env overrides first
    const forceDemo = (import.meta?.env?.VITE_FORCE_DEMO_USERS ?? 'false') === 'true';
    if (forceDemo) return 'demo';

    const demoList = (import.meta?.env?.VITE_DEMO_EMAILS ?? '').toLowerCase();
    const isDemoListed = demoList.split(',').map(s => s.trim()).filter(Boolean).includes(email);
    if (isDemoListed) return 'demo';

    // Check optional Supabase column: admin_users.dashboard_access
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('dashboard_access')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.log('⚠️ dashboard_access query error:', error.message);
        return 'real';
      }
      
      const access = data?.dashboard_access ?? 'real';
      return access === 'demo' ? 'demo' : 'real';
    } catch (e) {
      console.log('⚠️ getDashboardAccess error:', e.message);
      return 'real';
    }
  }

  async updateUserMetadata(userId, metadata) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: metadata
    });

    if (error) {
      throw error;
    }
  }

  async getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  // Clear admin cache (useful for testing or forced refresh)
  clearCache() {
    this.adminCache.clear();
  }
}
