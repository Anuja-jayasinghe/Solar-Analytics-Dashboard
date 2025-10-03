import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function AdminDashboard() {
  const [tab, setTab] = useState("ceb");
  const [cebData, setCebData] = useState([]);
  const [inverterData, setInverterData] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ date: "", generation_kwh: "" });
  const [adminEmail, setAdminEmail] = useState("");
  const [message, setMessage] = useState("");

  // Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === "ceb") {
        const { data, error } = await supabase
          .from("ceb_data")
          .select("*")
          .order("date", { ascending: false });
        if (error) throw error;
        setCebData(data || []);
      } else if (tab === "inverter") {
        const { data, error } = await supabase
          .from("inverter_data")
          .select("*")
          .order("date", { ascending: false });
        if (error) throw error;
        setInverterData(data || []);
      } else if (tab === "admins") {
        const { data, error } = await supabase
          .from("admin_users")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setAdmins(data || []);
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  // Add records
  const addRecord = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const table = tab === "ceb" ? "ceb_data" : "inverter_data";
      const { error } = await supabase.from(table).insert([
        {
          date: form.date,
          generation_kwh: parseFloat(form.generation_kwh),
        },
      ]);
      if (error) throw error;
      setMessage("✅ Record added");
      setForm({ date: "", generation_kwh: "" });
      fetchData();
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Add admin
  const addAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("admin_users")
        .insert([{ email: adminEmail.trim().toLowerCase() }]);
      if (error) throw error;
      setMessage("✅ Admin added");
      setAdminEmail("");
      fetchData();
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Ask for delete confirmation
  const requestDelete = (table, identifier) => {
    // identifier: { type: "id" | "email", value: any }
    setDeleteTarget({ table, identifier });
    setConfirmOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      let query = supabase.from(deleteTarget.table).delete();

      if (deleteTarget.identifier.type === "email") {
        query = query.eq("email", deleteTarget.identifier.value);
      } else {
        query = query.eq("id", deleteTarget.identifier.value);
      }

      const { error } = await query;
      if (error) throw error;

      setMessage("✅ Deleted successfully");
      fetchData();
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
    setConfirmOpen(false);
    setDeleteTarget(null);
    setLoading(false);
  };

  // Cancel delete
  const cancelDelete = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  // Reusable Table Renderer
  const renderTable = (rows, type) => (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: "1rem",
        background: "#1a1a1a",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <thead style={{ background: "var(--accent)" }}>
        <tr>
          {type === "admin" ? (
            <>
              <th style={{ padding: "12px", textAlign: "left", color: "#fff" }}>Email</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#fff" }}>Created</th>
              <th style={{ padding: "12px", color: "#fff" }}>Actions</th>
            </>
          ) : (
            <>
              <th style={{ padding: "12px", textAlign: "left", color: "#fff" }}>Date</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#fff" }}>Generation (kWh)</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#fff" }}>Earnings</th>
              <th style={{ padding: "12px", color: "#fff" }}>Actions</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id || row.email}
            style={{ borderBottom: "1px solid #333", color: "var(--text-color)" }}
          >
            {type === "admin" ? (
              <>
                <td style={{ padding: "10px" }}>{row.email}</td>
                <td style={{ padding: "10px" }}>
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "10px" }}>
                  <button
                    onClick={() =>
                      requestDelete("admin_users", { type: "email", value: row.email })
                    }
                    style={{
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </>
            ) : (
              <>
                <td style={{ padding: "10px" }}>{row.date}</td>
                <td style={{ padding: "10px" }}>{row.generation_kwh}</td>
                <td style={{ padding: "10px" }}>{row.earnings}</td>
                <td style={{ padding: "10px" }}>
                  <button
                    onClick={() =>
                      requestDelete(
                        tab === "ceb" ? "ceb_data" : "inverter_data",
                        { type: "id", value: row.id }
                      )
                    }
                    style={{
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ color: "var(--accent)", marginBottom: "1rem" }}>⚡ Admin Dashboard</h1>

      {/* Tabs */}
      <div style={{ marginBottom: "1rem" }}>
        {["ceb", "inverter", "admins"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? "var(--accent)" : "#333",
              color: "#fff",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              marginRight: "8px",
              cursor: "pointer",
            }}
          >
            {t === "ceb" ? "CEB Data" : t === "inverter" ? "Inverter Data" : "Admins"}
          </button>
        ))}
      </div>

      {/* Forms */}
      {tab !== "admins" ? (
        <form
          onSubmit={addRecord}
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "1.5rem",
            background: "#111",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              flex: "1",
            }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Generation (kWh)"
            value={form.generation_kwh}
            onChange={(e) => setForm({ ...form, generation_kwh: e.target.value })}
            required
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              flex: "1",
            }}
          />
          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#fff",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={addAdmin}
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "1.5rem",
            background: "#111",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          <input
            type="email"
            placeholder="Admin Email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              flex: "1",
            }}
          />
          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#fff",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {loading ? "Adding..." : "Add Admin"}
          </button>
        </form>
      )}

      {/* Data Tables */}
      {loading ? (
        <p>Loading...</p>
      ) : tab === "ceb" ? (
        renderTable(cebData, "data")
      ) : tab === "inverter" ? (
        renderTable(inverterData, "data")
      ) : (
        renderTable(admins, "admin")
      )}

      {message && (
        <p style={{ marginTop: "1rem", color: message.includes("❌") ? "red" : "lime" }}>
          {message}
        </p>
      )}

      {/* Confirmation Modal */}
      {confirmOpen && deleteTarget && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              background: "rgba(20,20,20,0.8)",
              backdropFilter: "blur(12px)",
              borderRadius: "10px",
              padding: "2rem",
              color: "#fff",
              textAlign: "center",
              maxWidth: "400px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <h2 style={{ marginBottom: "1rem", color: "var(--accent)" }}>
              Confirm Deletion
            </h2>
            <p style={{ marginBottom: "1.5rem" }}>
              {deleteTarget.identifier.type === "email"
                ? `Are you sure you want to delete admin: ${deleteTarget.identifier.value}?`
                : "Are you sure you want to delete this record?"}
              <br />
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
              <button
                onClick={cancelDelete}
                style={{
                  background: "#444",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  background: "#dc3545",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
