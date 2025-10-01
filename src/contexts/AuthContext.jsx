import React, { createContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // helper: check admin_users table for user.email
  async function checkAdmin(email) {
    if (!email) {
      console.log("🔍 Admin check: No email provided");
      return false;
    }
    console.log("🔍 Admin check: Checking email:", email);
    console.log("🔍 Admin check: Starting database query...");
    
    try {
      const startTime = Date.now();
      
      // Add timeout to prevent hanging
      const queryPromise = supabase
        .from("admin_users")
        .select("email")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      );
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      const endTime = Date.now();
      console.log("🔍 Admin check: Query completed in", endTime - startTime, "ms");

      if (error) {
        console.log("❌ Admin table check failed:", error);
        console.log("❌ Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return false; // strict deny on error
      }

      const isAdmin = !!data;
      console.log("✅ Admin check result:", isAdmin, "Data:", data);
      return isAdmin; // true if a matching admin email exists
    } catch (error) {
      console.log("❌ Admin check error:", error);
      console.log("❌ Error stack:", error.stack);
      return false; // strict deny on error
    }
  }

  useEffect(() => {
    // load initial session (supabase persists it automatically)
    const init = async () => {
      console.log("🔄 AuthContext: Initializing...");
      console.log("🔧 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log("🔧 Supabase Key exists:", !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
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

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, isAdmin, loading, setIsAdmin, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
