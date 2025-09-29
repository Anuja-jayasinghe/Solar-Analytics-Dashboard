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
    if (!email) return false;
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("username")
        .eq("username", email)
        .limit(1)
        .maybeSingle();
      
      // If table doesn't exist or error, allow all authenticated users as admin for now
      if (error) {
        console.log("Admin table check failed, allowing user as admin:", error.message);
        return true;
      }
      
      return !!data;
    } catch (error) {
      console.log("Admin check error, allowing user as admin:", error.message);
      return true;
    }
  }

  useEffect(() => {
    // load initial session (supabase persists it automatically)
    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user?.email) {
        const admin = await checkAdmin(currentSession.user.email);
        setIsAdmin(admin);
      }
      setLoading(false);
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
