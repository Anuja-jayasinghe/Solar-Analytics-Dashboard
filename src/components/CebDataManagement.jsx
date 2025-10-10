import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const CebDataManagement = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    bill_date: "",
    meter_reading: "",
    units_exported: "",
    earnings: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rate, setRate] = useState(null);

  // ✅ Fetch current system settings (rate_per_kwh)
  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("setting_name", "rate_per_kwh")
      .single();

    if (error) {
      console.warn("⚠️ Failed to fetch rate_per_kwh:", error);
    } else {
      setRate(data?.setting_value || 0);
    }
  };

  // ✅ Fetch CEB data
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ceb_data")
      .select("*")
      .order("bill_date", { ascending: false });

    if (error) {
      setMessage(`❌ Error loading data: ${error.message}`);
    } else {
      setData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
    fetchData();
  }, []);

  // ✅ Handle add or update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (editingId) {
        // update
        const { error } = await supabase
          .from("ceb_data")
          .update({
            bill_date: form.bill_date,
            meter_reading: parseFloat(form.meter_reading),
            units_exported: parseFloat(form.units_exported),
            earnings: parseFloat(form.earnings),
          })
          .eq("id", editingId);

        if (error) throw error;
        setMessage("✅ Record updated successfully.");
      } else {
        // insert new
        const { error } = await supabase.from("ceb_data").insert([
          {
            bill_date: form.bill_date,
            meter_reading: parseFloat(form.meter_reading),
            units_exported: parseFloat(form.units_exported),
            earnings: parseFloat(form.earnings),
          },
        ]);
        if (error) throw error;
        setMessage("✅ Record added successfully.");
      }

      setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "" });
      setEditingId(null);
      fetchData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Ask confirmation before delete
  const requestDelete = (id) => {
    setDeleteTarget(id);
    setConfirmOpen(true);
  };

  // ✅ Delete confirmed
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);

    const { error } = await supabase.from("ceb_data").delete().eq("id", deleteTarget);

    if (error) {
      setMessage(`❌ Error deleting record: ${error.message}`);
    } else {
      setMessage("✅ Record deleted.");
      fetchData();
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

  // ✅ Fill form for editing
  const startEdit = (record) => {
    setForm({
      bill_date: record.bill_date,
      meter_reading: record.meter_reading,
      units_exported: record.units_exported,
      earnings: record.earnings,
    });
    setEditingId(record.id);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto", color: "#fff" }}>
      <h1 style={{ color: "var(--accent)", marginBottom: "1rem" }}>⚙️ CEB Data Management</h1>

      {/* Info */}
      <p style={{ color: "#aaa", marginBottom: "1.5rem" }}>
        Manage your monthly CEB export readings and earnings.  
        Current Tariff: <span style={{ color: "#ff7a00", fontWeight: "bold" }}>{rate ? `LKR ${rate}/kWh` : "Not set"}</span>
      </p>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
          type="date"
          value={form.bill_date}
          onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Meter Reading"
          value={form.meter_reading}
          onChange={(e) => setForm({ ...form, meter_reading: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Units Exported"
          value={form.units_exported}
          onChange={(e) => setForm({ ...form, units_exported: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Earnings (from bill)"
          value={form.earnings}
          onChange={(e) => setForm({ ...form, earnings: e.target.value })}
          required
          style={inputStyle}
        />
        <button type="submit" style={buttonStyle}>
          {loading ? "Saving..." : editingId ? "Update" : "Add Record"}
        </button>
      </form>

      {/* Data Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={tableStyle}>
          <thead style={{ background: "rgba(255,122,0,0.2)" }}>
            <tr>
              <th>Date</th>
              <th>Meter Reading</th>
              <th>Units Exported</th>
              <th>Earnings (LKR)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.bill_date}</td>
                <td>{row.meter_reading}</td>
                <td>{row.units_exported}</td>
                <td>{row.earnings}</td>
                <td>
                  <button style={editBtn} onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  <button style={deleteBtn} onClick={() => requestDelete(row.id)}>
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
            <h2 style={{ color: "#ff7a00" }}>Confirm Deletion</h2>
            <p>This action cannot be undone. Are you sure?</p>
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
const inputStyle = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #333",
  background: "rgba(30,30,30,0.8)",
  color: "#fff",
};

const buttonStyle = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  padding: "10px",
  borderRadius: "6px",
  cursor: "pointer",
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

const editBtn = {
  background: "#00c2a8",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  marginRight: "5px",
  cursor: "pointer",
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

export default CebDataManagement;
