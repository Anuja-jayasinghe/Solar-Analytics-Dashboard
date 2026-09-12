import React, { createContext, useEffect, useState } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { createAuthAdapter, isClerkEnabled } from "../lib/auth/AuthFactory";

export const AuthContext = createContext();

function AuthProviderInner({ children, clerkUser, clerkAuth, clerk }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardAccess, setDashboardAccess] = useState('real'); // 'demo' | 'real'
  const [authAdapter, setAuthAdapter] = useState(null);
  
  // Clerk values arrive as props. See the note at the bottom of this file for why they are
  // no longer read from conditionally-called hooks here.

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

// ---------------------------------------------------------------------------
// Why this is split in two
//
// AuthProviderInner used to call the Clerk hooks conditionally:
//
//   const clerkUser = isClerkEnabled() ? useUser() : { user: null, isLoaded: true }
//
// That breaks the rules of hooks. It happened not to crash, because isClerkEnabled() reads
// a build-time env flag and so never changes between renders — but the rule had been
// downgraded to a lint *warning* precisely to let this through, and a warning is not a
// guarantee. (Issue #114.)
//
// The hooks cannot simply be hoisted: <ClerkProvider> is only mounted when the flag is on
// (see App.jsx), and Clerk's hooks throw without it. So the branch moves up a level — each
// component below calls its hooks unconditionally, and which component renders is what
// varies. That is legal, and it lets rules-of-hooks go back to being an error.
// ---------------------------------------------------------------------------

/** Only ever rendered inside <ClerkProvider>, so these hooks are always safe here. */
function ClerkAuthProvider({ children }) {
  const clerkUser = useUser();
  const clerkAuth = useAuth();
  const clerk = useClerk();

  return (
    <AuthProviderInner clerkUser={clerkUser} clerkAuth={clerkAuth} clerk={clerk}>
      {children}
    </AuthProviderInner>
  );
}

/** Legacy Supabase auth path. Calls no Clerk hooks at all. */
function SupabaseAuthProvider({ children }) {
  return (
    <AuthProviderInner
      clerkUser={{ user: null, isLoaded: true }}
      clerkAuth={{ isLoaded: true }}
      clerk={null}
    >
      {children}
    </AuthProviderInner>
  );
}

export function AuthProvider({ children }) {
  return isClerkEnabled()
    ? <ClerkAuthProvider>{children}</ClerkAuthProvider>
    : <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}
