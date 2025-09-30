import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function AdminSetup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Unknown");

  // 🔹 Test Supabase connection
  const testConnection = async () => {
    console.log("Testing Supabase connection...");
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .limit(1);

      if (error) {
        console.error("Connection test error:", error);
        if (error.code === "PGRST116") {
          setConnectionStatus("❌ Table 'admin_users' does not exist. You need to create it in Supabase.");
        } else {
          setConnectionStatus(`❌ Error: ${error.message}`);
        }
      } else {
        console.log("Connection test successful:", data);
        setConnectionStatus("✅ Connected - Table exists");
      }
    } catch (err) {
      console.error("Connection test failed:", err);
      setConnectionStatus(`❌ Failed: ${err.message}`);
    }
  };

  // 🔹 Create admin_users table using SQL
  const createTable = async () => {
    setLoading(true);
    setMessage("Creating admin_users table...");
    
    try {
      // Try to create the table using SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id BIGSERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (error) {
        console.error("Table creation error:", error);
        setMessage(`❌ Failed to create table: ${error.message}`);
      } else {
        setMessage("✅ Table created successfully!");
        setConnectionStatus("✅ Table created");
      }
    } catch (err) {
      console.error("Table creation failed:", err);
      setMessage(`❌ Table creation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Add new admin
  const addAdmin = async (e) => {
    e.preventDefault();
    if (!email) return;

    console.log("Adding admin:", email);
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .insert([{ email: email.trim().toLowerCase() }])
        .select();

      if (error) {
        console.error("Insert error:", error);
        if (error.code === "23505") {
          setMessage("⚠️ This email is already an admin!");
        } else {
          setMessage(`❌ Error: ${error.message}`);
        }
      } else {
        setMessage(`✅ Success! ${email} is now an admin.`);
        setEmail("");
      }
    } catch (err) {
      console.error("Catch error:", err);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 List all admins
  const listAdmins = async () => {
    console.log("Listing admins...");
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("email, created_at")
        .order("created_at", { ascending: false });

      console.log("Supabase response:", { data, error });

      if (error) {
        console.error("Select error:", error);
        setMessage(`❌ Error: ${error.message}`);
      } else if (data && data.length > 0) {
        setMessage(
          `👑 Current admins (${data.length}): ${data
            .map((a) => a.email)
            .join(", ")}`
        );
      } else {
        setMessage("⚠️ No admins found in the database.");
      }
    } catch (err) {
      console.error("Catch error:", err);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "2rem auto",
        padding: "2rem",
        background: "var(--sidebar-bg)",
        borderRadius: "8px",
        color: "var(--text-color)",
      }}
    >
      <h1>🔧 Admin Setup</h1>
      <p>Add admin users to the system</p>
      
      <div style={{ 
        marginBottom: "1rem", 
        padding: "12px", 
        background: "rgba(255,193,7,0.1)", 
        border: "1px solid rgba(255,193,7,0.3)",
        borderRadius: "4px",
        fontSize: "14px"
      }}>
        <strong>⚠️ If database operations fail:</strong><br/>
        1. Go to your Supabase dashboard<br/>
        2. Navigate to SQL Editor<br/>
        3. Run this SQL to create the table:<br/>
        <code style={{ 
          display: "block", 
          marginTop: "8px", 
          padding: "8px", 
          background: "rgba(0,0,0,0.1)", 
          borderRadius: "4px",
          fontSize: "12px"
        }}>
          CREATE TABLE admin_users (<br/>
          &nbsp;&nbsp;id BIGSERIAL PRIMARY KEY,<br/>
          &nbsp;&nbsp;email TEXT NOT NULL UNIQUE,<br/>
          &nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()<br/>
          );
        </code>
      </div>

      {/* Connection Test */}
      <div
        style={{
          marginBottom: "1rem",
          padding: "8px",
          background: "rgba(0,0,0,0.1)",
          borderRadius: "4px",
        }}
      >
        <strong>Connection Status:</strong> {connectionStatus}
        <button
          onClick={testConnection}
          style={{
            background: "#007bff",
            color: "#fff",
            border: "none",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            marginLeft: "8px",
            fontSize: "12px",
          }}
        >
          Test Connection
        </button>
      </div>

      {/* Add Admin Form */}
      <form onSubmit={addAdmin} style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Admin Email:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              background: "var(--bg-color)",
              color: "var(--text-color)",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Adding..." : "Add Admin"}
        </button>
      </form>

      {/* List Admins Button */}
      <button
        onClick={listAdmins}
        disabled={loading}
        style={{
          background: "#666",
          color: "#fff",
          border: "none",
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          marginRight: "1rem",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Loading..." : "List Current Admins"}
      </button>

        {/* Reset Button */}
        <button
          onClick={() => {
            setLoading(false);
            setMessage("");
          }}
          style={{
            background: "#ff4444",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "1rem",
          }}
        >
          Reset
        </button>

        {/* Create Table Button */}
        <button
          onClick={createTable}
          disabled={loading}
          style={{
            background: "#28a745",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Creating..." : "Create Table"}
        </button>

      {message && (
        <div
          style={{
            marginTop: "1rem",
            padding: "12px",
            background: message.includes("Error")
              ? "rgba(255,68,68,0.1)"
              : "rgba(34,197,94,0.1)",
            border: `1px solid ${
              message.includes("Error")
                ? "rgba(255,68,68,0.3)"
                : "rgba(34,197,94,0.3)"
            }`,
            borderRadius: "4px",
            color: message.includes("Error") ? "#ff4444" : "#22c55e",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default AdminSetup;
