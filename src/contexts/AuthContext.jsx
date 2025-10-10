import React, { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Simple admin cache to avoid repeated DB calls
  const [adminCache, setAdminCache] = useState(new Map());

  // helper: check admin_users table for user.email with retry logic and caching
  async function checkAdmin(email, retryCount = 0) {
    if (!email) {
      console.log("🔍 Admin check: No email provided");
      return false;
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check cache first
    if (adminCache.has(normalizedEmail)) {
      const cachedResult = adminCache.get(normalizedEmail);
      console.log(`🔍 Admin check: Using cached result for ${normalizedEmail}:`, cachedResult);
      return cachedResult;
    }
    
    const maxRetries = 2;
    console.log(`🔍 Admin check: Checking email: ${normalizedEmail} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    try {
      const startTime = Date.now();
      
      console.log("🔍 Admin check: Starting connection test...");
      
      // First, test database connection with a simple query
      const connectionTestPromise = supabase
        .from("admin_users")
        .select("count", { count: "exact", head: true })
        .limit(1);
      
      const connectionTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout after 3 seconds')), 3000)
      );
      
      const connectionTest = await Promise.race([connectionTestPromise, connectionTimeoutPromise]);
      
      if (connectionTest.error) {
        console.log("❌ Connection test failed:", connectionTest.error);
        throw new Error(`Database connection failed: ${connectionTest.error.message}`);
      }
      
      console.log("🔍 Admin check: Database connection verified");
      
      // Now perform the actual admin check with shorter timeout
      console.log("🔍 Admin check: Starting admin query...");
      const queryPromise = supabase
        .from("admin_users")
        .select("email")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      const endTime = Date.now();
      console.log(`🔍 Admin check: Query completed in ${endTime - startTime}ms`);

      if (error) {
        console.log("❌ Admin table check failed:", error);
        
        // Retry on certain errors
        if (retryCount < maxRetries && (
          error.message.includes('timeout') || 
          error.message.includes('network') ||
          error.code === 'PGRST301' // connection error
        )) {
          console.log(`🔄 Retrying admin check (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // exponential backoff
          return checkAdmin(email, retryCount + 1);
        }
        
        // IMPROVED: Don't deny access on database errors, use cached result if available
        console.log("⚠️ Database error, checking for cached admin status...");
        if (adminCache.has(normalizedEmail)) {
          const cachedResult = adminCache.get(normalizedEmail);
          console.log(`🔍 Using cached result due to database error: ${cachedResult}`);
          return cachedResult;
        }
        
        // If no cache and database is down, assume non-admin (safer default)
        console.log("⚠️ No cached result available, defaulting to non-admin due to database error");
        return false;
      }

      const isAdmin = !!data;
      console.log("✅ Admin check result:", isAdmin, "Data:", data);
      
      // Cache the result for 5 minutes
      setAdminCache(prev => {
        const newCache = new Map(prev);
        newCache.set(normalizedEmail, isAdmin);
        return newCache;
      });
      
      return isAdmin;
      
    } catch (error) {
      console.log("❌ Admin check error:", error);
      console.log("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        retryCount,
        maxRetries
      });
      
      // Retry on timeout or connection errors
      if (retryCount < maxRetries && (
        error.message.includes('timeout') || 
        error.message.includes('connection') ||
        error.message.includes('network') ||
        error.message.includes('fetch')
      )) {
        console.log(`🔄 Retrying admin check due to ${error.message} (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return checkAdmin(email, retryCount + 1);
      }
      
      // IMPROVED: Don't deny access on network errors, use cached result if available
      console.log("⚠️ Network error, checking for cached admin status...");
      if (adminCache.has(normalizedEmail)) {
        const cachedResult = adminCache.get(normalizedEmail);
        console.log(`🔍 Using cached result due to network error: ${cachedResult}`);
        return cachedResult;
      }
      
      // If no cache and network is down, assume non-admin (safer default)
      console.log("⚠️ No cached result available, defaulting to non-admin due to network error");
      return false;
    }
  }

  useEffect(() => {
    // load initial session (supabase persists it automatically)
    const init = async () => {
      console.log("🔄 AuthContext: Initializing...");
      console.log("🔧 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log("🔧 Supabase Key exists:", !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      // Test basic Supabase connection first
      try {
        console.log("🔍 Testing basic Supabase connection...");
        const { data, error } = await supabase.from("admin_users").select("count", { count: "exact", head: true }).limit(1);
        if (error) {
          console.log("❌ Basic Supabase test failed:", error);
        } else {
          console.log("✅ Basic Supabase connection successful");
        }
      } catch (testError) {
        console.log("❌ Supabase connection test error:", testError);
      }
      
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      console.log("🔐 AuthContext: Current session:", currentSession?.user?.email || "No session");
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user?.email) {
        console.log("🔍 AuthContext: Starting admin check for:", currentSession.user.email);
        const admin = await checkAdmin(currentSession.user.email);
        setIsAdmin(admin);
        console.log("👤 AuthContext: Admin status set to:", admin);
      }
      setLoading(false);
      console.log("✅ AuthContext: Initialization complete");
    };
    init();

    // subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.email) {
          const admin = await checkAdmin(s.user.email);
          setIsAdmin(admin);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // Handle tab visibility changes to refresh auth state when user returns
    const handleVisibilityChange = async () => {
      if (!document.hidden && session?.user?.email) {
        console.log("🔄 Tab became visible, refreshing admin status...");
        const admin = await checkAdmin(session.user.email);
        setIsAdmin(admin);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user?.email]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setAdminCache(new Map()); // Clear admin cache on sign out
  };

  // Function to refresh admin status (useful after admin changes)
  const refreshAdminStatus = async () => {
    if (user?.email) {
      setAdminCache(new Map()); // Clear cache
      const admin = await checkAdmin(user.email);
      setIsAdmin(admin);
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, isAdmin, loading, setIsAdmin, signOut, refreshAdminStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}
