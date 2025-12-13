import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import useTablePagination from "../../../hooks/useTablePagination";
import SkeletonLoader from "../../shared/SkeletonLoader";
import ConfirmDialog from "../../shared/ConfirmDialog";
import CebForm from "./CebForm";
import CebTable from "./CebTable";

/**
 * CEB Data Management Component
 * Manages CEB billing data entry and CRUD operations
 * All core logic kept the same - only added pagination
 */
const CebDataManagement = () => {
  const [allData, setAllData] = useState([]);
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

  // Pagination hook
  const {
    currentPage,
    itemsPerPage,
    paginate,
    setItemsPerPage,
    paginatedData,
    totalItems
  } = useTablePagination(allData, 20);

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
      console.error("CEB data fetch error:", error);
    } else {
      setAllData(data || []);
      console.log("CEB data loaded:", data);
    }
    setLoading(false);
  };

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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
      const recordData = {
        bill_date: form.bill_date,
        meter_reading: parseFloat(form.meter_reading) || 0,
        units_exported: parseFloat(form.units_exported) || 0,
        earnings: parseFloat(form.earnings) || 0,
      };

      if (editingId) {
        // update
        const { error } = await supabase
          .from("ceb_data")
          .update(recordData)
          .eq("id", editingId);

        if (error) throw error;
        setMessage("✅ Record updated successfully.");
      } else {
        // insert new
        const { error } = await supabase.from("ceb_data").insert([recordData]);
        if (error) throw error;
        setMessage("✅ Record added successfully.");
      }

      setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "" });
      setEditingId(null);
      fetchData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      console.error("Submit error:", err);
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

  if (loading && allData.length === 0) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2 style={{ color: "var(--accent)", margin: "0 0 1rem 0" }}>⚙️ CEB Data Management</h2>
        <SkeletonLoader count={5} variant="user" />
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto", color: "var(--text-color)" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ color: "var(--accent)", margin: "0 0 0.5rem 0", fontSize: "28px" }}>
          ⚙️ CEB Data Management
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px" }}>
          Manage your monthly CEB export readings and earnings.
          Current Tariff: <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
            {rate ? `LKR ${rate}/kWh` : "Not set"}
          </span>
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          padding: '12px 16px',
          background: message.includes('❌') ? '#f8d7da' : '#d4edda',
          color: message.includes('❌') ? '#721c24' : '#155724',
          border: message.includes('❌') ? '1px solid #f5c6cb' : '1px solid #c3e6cb',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}

      {/* Form Component */}
      <CebForm
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        loading={loading}
        editingId={editingId}
        onCancelEdit={() => {
          setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "" });
          setEditingId(null);
        }}
      />

      {/* Table Component */}
      <CebTable
        data={paginatedData}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        onPageChange={paginate}
        onItemsPerPageChange={setItemsPerPage}
        onEdit={startEdit}
        onDelete={requestDelete}
        loading={loading}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Deletion"
        message="This action cannot be undone. Are you sure you want to delete this CEB record?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={loading}
        isDangerous={true}
      />
    </div>
  );
};

export default CebDataManagement;
