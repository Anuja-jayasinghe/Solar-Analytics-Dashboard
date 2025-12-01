/**
 * Auth Factory
 * Creates the appropriate auth adapter based on environment configuration
 */

import { SupabaseAuthAdapter } from './SupabaseAuthAdapter.js';
import { ClerkAuthAdapter } from './ClerkAuthAdapter.js';

/**
 * Create auth adapter based on feature flag
 * @returns {AuthAdapter}
 */
export function createAuthAdapter(clerkDependencies = null) {
  const useClerk = import.meta.env.VITE_USE_CLERK_AUTH === 'true';

  if (useClerk) {
    if (!clerkDependencies) {
      throw new Error('Clerk dependencies required when VITE_USE_CLERK_AUTH is true');
    }

    const { clerkInstance, useUser, useAuth } = clerkDependencies;
    return new ClerkAuthAdapter(clerkInstance, useUser, useAuth);
  }

  return new SupabaseAuthAdapter();
}

/**
 * Get current auth provider name
 * @returns {string} "clerk" | "supabase"
 */
export function getAuthProvider() {
  return import.meta.env.VITE_USE_CLERK_AUTH === 'true' ? 'clerk' : 'supabase';
}

/**
 * Check if Clerk is enabled
 * @returns {boolean}
 */
export function isClerkEnabled() {
  return import.meta.env.VITE_USE_CLERK_AUTH === 'true';
}

/**
 * Check if Supabase is enabled
 * @returns {boolean}
 */
export function isSupabaseEnabled() {
  return import.meta.env.VITE_USE_CLERK_AUTH !== 'true';
}
