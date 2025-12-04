import React, { createContext, useEffect, useState } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { createAuthAdapter, isClerkEnabled } from "../lib/auth/AuthFactory";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardAccess, setDashboardAccess] = useState('real'); // 'demo' | 'real'
  const [authAdapter, setAuthAdapter] = useState(null);
  
  // Clerk hooks (only used if Clerk is enabled)
  const clerkUser = isClerkEnabled() ? useUser() : { user: null, isLoaded: true };
  const clerkAuth = isClerkEnabled() ? useAuth() : { isLoaded: true };
  const clerk = isClerkEnabled() ? useClerk() : null;

  // Initialize auth adapter on mount
  useEffect(() => {
    console.log("🔄 AuthContext: Initializing auth adapter...");
    console.log("🔧 Auth provider:", isClerkEnabled() ? "Clerk" : "Supabase");
    
    try {
      let adapter;
      
      if (isClerkEnabled()) {
        // Create Clerk adapter with React hooks
        adapter = createAuthAdapter({
          clerkInstance: clerk,
          useUser: () => clerkUser,
          useAuth: () => clerkAuth
        });
        console.log("✅ Clerk adapter created");
      } else {
        // Create Supabase adapter (no dependencies needed)
        adapter = createAuthAdapter();
        console.log("✅ Supabase adapter created");
      }
      
      setAuthAdapter(adapter);
    } catch (error) {
      console.error("❌ Failed to create auth adapter:", error);
      setLoading(false);
    }
  }, []); // Only run once on mount

  // Load initial session and user
  useEffect(() => {
    if (!authAdapter) return;

    // If using Clerk, wait for it to be loaded
    if (isClerkEnabled() && !clerkUser.isLoaded) {
      console.log("⏳ AuthContext: Waiting for Clerk to load...");
      return;
    }

    const loadSession = async () => {
      console.log("🔄 AuthContext: Loading initial session...");
      setLoading(true);

      try {
        const currentSession = await authAdapter.getSession();
        const currentUser = await authAdapter.getCurrentUser();
        
        console.log("🔐 AuthContext: Session loaded:", currentUser?.email || "No session");
        
        setSession(currentSession);
        setUser(currentUser);

        if (currentUser?.email) {
          console.log("🔍 AuthContext: Checking admin status for:", currentUser.email);
          
          const admin = await authAdapter.checkIsAdmin(currentUser);
          const access = await authAdapter.getDashboardAccess(currentUser);
          
          setIsAdmin(admin);
          setDashboardAccess(access);
          
          console.log("👤 AuthContext: Admin status:", admin);
          console.log("🪪 AuthContext: Dashboard access:", access);
        }
      } catch (error) {
        console.error("❌ Failed to load session:", error);
      } finally {
        setLoading(false);
        console.log("✅ AuthContext: Initialization complete");
      }
    };

    loadSession();
  }, [authAdapter, clerkUser.isLoaded]); // Add clerkUser.isLoaded dependency

  // Subscribe to auth state changes
  useEffect(() => {
    if (!authAdapter) return;

    console.log("🔄 AuthContext: Setting up auth state listener...");

    const unsubscribe = authAdapter.onAuthStateChange(async (event, newSession) => {
      console.log("🔄 Auth state changed:", event);
      
      setSession(newSession);
      const newUser = newSession ? await authAdapter.getCurrentUser() : null;
      setUser(newUser);

      if (newUser?.email) {
        const admin = await authAdapter.checkIsAdmin(newUser);
        const access = await authAdapter.getDashboardAccess(newUser);
        setIsAdmin(admin);
        setDashboardAccess(access);
      } else {
        setIsAdmin(false);
        setDashboardAccess('real');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [authAdapter]);

  // Handle tab visibility changes (refresh auth state when user returns)
  useEffect(() => {
    if (!authAdapter || !session?.user?.email) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden && user?.email) {
        console.log("🔄 Tab became visible, refreshing auth status...");
        try {
          const admin = await authAdapter.checkIsAdmin(user);
          const access = await authAdapter.getDashboardAccess(user);
          setIsAdmin(admin);
          setDashboardAccess(access);
        } catch (error) {
          console.error("❌ Failed to refresh auth status:", error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authAdapter, user]);

  // Sign out function
  const signOut = async () => {
    if (!authAdapter) return;

    try {
      await authAdapter.signOut();
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setDashboardAccess('real');
    } catch (error) {
      console.error("❌ Sign out failed:", error);
    }
  };

  // Refresh admin status
  const refreshAdminStatus = async () => {
    if (!authAdapter || !user?.email) return;

    try {
      const admin = await authAdapter.checkIsAdmin(user);
      const access = await authAdapter.getDashboardAccess(user);
      setIsAdmin(admin);
      setDashboardAccess(access);
    } catch (error) {
      console.error("❌ Failed to refresh admin status:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAdmin,
        loading,
        dashboardAccess,
        hasRealAccess: () => dashboardAccess === 'real',
        setIsAdmin,
        signOut,
        refreshAdminStatus,
        authAdapter // Expose adapter for advanced usage
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
