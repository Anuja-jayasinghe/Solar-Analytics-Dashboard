import React, { useState, useContext } from "react";
import { supabase } from "../lib/supabaseClient";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../components/ThemeContext";

export default function AdminLogin() {
  const { user } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    // Check if user is admin before redirecting
    // This will be handled by the AuthContext
    navigate("/admin/dashboard");
    return null;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admin/dashboard`
        },
      });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/dashboard`
        }
      });
      if (error) throw error;
      setError("Check your email for the magic link!");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h1>⚡ Solar Analytics</h1>
          <h2>Admin Portal</h2>
          <p>Sign in to access the admin dashboard</p>
        </div>

        {error && (
          <div className={`error-message ${error.includes("Check your email") ? "success" : ""}`}>
            {error}
          </div>
        )}

        <div className="admin-login-options">
          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="google-signin-btn"
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <form onSubmit={handleMagicLink} className="magic-link-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !email}
              className="magic-link-btn"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        </div>

        <div className="admin-login-footer">
          <p>Secure admin access powered by Supabase</p>
        </div>
      </div>
    </div>
  );
}