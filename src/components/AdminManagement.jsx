import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ✅ Fetch admin users
  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching admins:", error);
      setMessage(`❌ Error fetching admins: ${error.message}`);
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // ✅ Add new admin
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage("⚠️ Please enter an email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("admin_users").insert([{ email }]);
      if (error) throw error;
      setMessage("✅ Admin added successfully.");
      setEmail("");
      fetchAdmins();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Ask before delete
  const requestDelete = (id) => {
    setDeleteTarget(id);
    setConfirmOpen(true);
  };

  // ✅ Confirm deletion
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    const { error } = await supabase.from("admin_users").delete().eq("id", deleteTarget);
    if (error) {
      setMessage(`❌ Error deleting admin: ${error.message}`);
    } else {
      setMessage("✅ Admin removed successfully.");
      fetchAdmins();
    }
    setConfirmOpen(false);
    setDeleteTarget(null);
    setLoading(false);
  };

  // ✅ Cancel delete
  const cancelDelete = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "#fff" }}>
      <h1 style={{ color: "var(--accent)", marginBottom: "1rem" }}>👥 Admin Management</h1>
      <p style={{ color: "#aaa", marginBottom: "1.5rem" }}>
        Manage admin access to the Solar Analytics Dashboard.
      </p>

      {/* Add Admin Form */}
      <form
        onSubmit={handleAdd}
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "2rem",
          background: "rgba(20,20,20,0.6)",
          padding: "1rem",
          borderRadius: "12px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 0 20px rgba(255,122,0,0.1)",
        }}
      >
        <input
          type="email"
          placeholder="Enter admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #333",
            background: "rgba(30,30,30,0.8)",
            color: "#fff",
          }}
        />
        <button type="submit" style={buttonStyle}>
          {loading ? "Adding..." : "➕ Add Admin"}
        </button>
      </form>

      {/* Admins Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
          <p>🔄 Loading admin users...</p>
        </div>
      ) : admins.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
          <p>📭 No admin users found.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead style={{ background: "rgba(255,122,0,0.2)" }}>
            <tr>
              <th>Email</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.email}</td>
                <td>{new Date(admin.created_at).toLocaleString()}</td>
                <td>
                  <button
                    style={deleteBtn}
                    onClick={() => requestDelete(admin.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: "#ff7a00" }}>Confirm Removal</h2>
            <p>Are you sure you want to remove this admin?</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
              <button onClick={cancelDelete} style={cancelBtn}>
                Cancel
              </button>
              <button onClick={confirmDelete} style={deleteBtn}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <p style={{ marginTop: "1rem", color: message.includes("❌") ? "red" : "lime" }}>
          {message}
        </p>
      )}
    </div>
  );
};

// --- Styles ---
const buttonStyle = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "rgba(20,20,20,0.6)",
  borderRadius: "10px",
  overflow: "hidden",
  textAlign: "left",
  boxShadow: "0 0 20px rgba(0,0,0,0.3)",
};

const deleteBtn = {
  background: "#dc3545",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer",
};

const cancelBtn = {
  background: "#444",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer",
};

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modalStyle = {
  background: "rgba(20,20,20,0.85)",
  backdropFilter: "blur(10px)",
  padding: "2rem",
  borderRadius: "12px",
  textAlign: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  maxWidth: "400px",
};

export default AdminManagement;
