import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
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
  const { getToken } = useAuth();
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedBillFile, setSelectedBillFile] = useState(null);
  const [selectedBillFiles, setSelectedBillFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [recentIngestions, setRecentIngestions] = useState([]);
  const [ingestionsLoading, setIngestionsLoading] = useState(false);
  const [ingestionsError, setIngestionsError] = useState("");
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationError, setReconciliationError] = useState("");
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
    fetchRecentIngestions();
    fetchBackfillReconciliation();
  }, []);

  const fetchAuthToken = async () => {
    const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME;
    if (template) {
      const token = await getToken({ template });
      if (token) return token;
    }
    return await getToken();
  };

  const readApiResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();
    return {
      error: text?.slice(0, 200) || `Request failed with status ${response.status}`,
    };
  };

  const fetchRecentIngestions = async () => {
    setIngestionsLoading(true);
    setIngestionsError("");

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error("No auth token");

      const response = await fetch("/api/ceb-bills/ingestions?limit=8", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(payload.details || payload.error || `Failed with status ${response.status}`);
      }

      setRecentIngestions(payload.ingestions || []);
    } catch (err) {
      console.error("CEB ingestion list fetch error:", err);
      setIngestionsError(err.message || "Failed to load ingestion history");
    } finally {
      setIngestionsLoading(false);
    }
  };

  const fetchBackfillReconciliation = async () => {
    setReconciliationLoading(true);
    setReconciliationError("");

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error("No auth token");

      const year = new Date().getFullYear();
      const response = await fetch(`/api/ceb-bills/reconciliation?year=${year}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(payload.details || payload.error || `Failed with status ${response.status}`);
      }

      setReconciliationData(payload);
    } catch (err) {
      console.error("CEB reconciliation fetch error:", err);
      setReconciliationError(err.message || "Failed to load backfill reconciliation");
    } finally {
      setReconciliationLoading(false);
    }
  };

  const uploadSingleFile = async (file, token) => {
    if (!file) {
      return { ok: false, error: "Missing file" };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_type", "manual_upload");

    const response = await fetch("/api/ceb-bills/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const payload = await readApiResponse(response);
    return {
      ok: response.ok,
      status: response.status,
      payload,
      fileName: file.name,
    };
  };

  const handleBillUpload = async () => {
    if (!selectedBillFile) {
      setMessage("❌ Please choose a file to upload.");
      return;
    }

    if (selectedBillFile.size > 10 * 1024 * 1024) {
      setMessage("❌ File is too large. Maximum supported size is 10MB.");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setMessage("");

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error("No auth token");

      const { ok, status, payload } = await uploadSingleFile(selectedBillFile, token);

      if (!ok) {
        if (status === 409) {
          setMessage(`⚠️ Duplicate bill detected. Existing ingestion ID: ${payload.ingestionId || "Unknown"}`);
          setUploadResult(payload);
          fetchRecentIngestions();
          return;
        }
        throw new Error(payload.details || payload.error || `Upload failed with status ${status}`);
      }

      setUploadResult(payload);
      setSelectedBillFile(null);
      setMessage("✅ Bill uploaded and saved successfully.");
      fetchRecentIngestions();
      fetchBackfillReconciliation();
    } catch (err) {
      console.error("CEB bill upload error:", err);
      setMessage(`❌ ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedBillFiles.length) {
      setMessage("❌ Please choose files for bulk upload.");
      return;
    }

    setBulkUploading(true);
    setBulkUploadResults([]);
    setMessage("");

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error("No auth token");

      const results = [];
      for (const file of selectedBillFiles) {
        if (file.size > 10 * 1024 * 1024) {
          results.push({
            fileName: file.name,
            ok: false,
            status: 400,
            message: "File too large (>10MB)",
          });
          continue;
        }

        const result = await uploadSingleFile(file, token);
        const messageFromApi = result.payload?.details || result.payload?.error || (result.ok ? "Uploaded" : "Failed");

        results.push({
          fileName: file.name,
          ok: result.ok,
          status: result.status,
          message: messageFromApi,
          ingestionId: result.payload?.ingestionId || null,
        });
      }

      setBulkUploadResults(results);
      setSelectedBillFiles([]);

      const successCount = results.filter((r) => r.ok).length;
      const duplicateCount = results.filter((r) => r.status === 409).length;
      const failCount = results.length - successCount - duplicateCount;
      setMessage(`✅ Bulk upload finished. Success: ${successCount}, Duplicates: ${duplicateCount}, Failed: ${failCount}`);

      fetchRecentIngestions();
      fetchBackfillReconciliation();
    } catch (err) {
      console.error("CEB bulk upload error:", err);
      setMessage(`❌ ${err.message}`);
    } finally {
      setBulkUploading(false);
    }
  };

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

      {/* Bill Upload (Step 1 foundation for OCR pipeline) */}
      <div style={{
        border: "1px solid var(--border-color)",
        borderRadius: "10px",
        padding: "1rem",
        marginBottom: "1rem",
        background: "var(--card-bg)"
      }}>
        <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--accent)" }}>Upload CEB Bill (Step 1)</h3>
        <p style={{ margin: "0 0 0.75rem 0", color: "var(--text-secondary)", fontSize: "13px" }}>
          Supported formats: PDF, PNG, JPG. Max size: 10MB.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setSelectedBillFile(e.target.files?.[0] || null)}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={handleBillUpload}
            disabled={uploading || !selectedBillFile}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "0.6rem 1rem",
              cursor: uploading || !selectedBillFile ? "not-allowed" : "pointer",
              opacity: uploading || !selectedBillFile ? 0.7 : 1
            }}
          >
            {uploading ? "Uploading..." : "Upload Bill"}
          </button>
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setSelectedBillFiles(Array.from(e.target.files || []))}
            disabled={bulkUploading}
          />
          <button
            type="button"
            onClick={handleBulkUpload}
            disabled={bulkUploading || selectedBillFiles.length === 0}
            style={{
              background: "#1f7a4f",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "0.6rem 1rem",
              cursor: bulkUploading || selectedBillFiles.length === 0 ? "not-allowed" : "pointer",
              opacity: bulkUploading || selectedBillFiles.length === 0 ? 0.7 : 1
            }}
          >
            {bulkUploading ? "Bulk Uploading..." : `Bulk Upload (${selectedBillFiles.length})`}
          </button>
        </div>

        {selectedBillFiles.length > 0 && (
          <p style={{ margin: "0.75rem 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            Bulk queue ready: <strong>{selectedBillFiles.length}</strong> files selected.
          </p>
        )}

        {selectedBillFile && (
          <p style={{ margin: "0.75rem 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            Selected: <strong>{selectedBillFile.name}</strong> ({(selectedBillFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        {uploadResult?.ingestionId && (
          <p style={{ margin: "0.75rem 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            Ingestion ID: <strong>{uploadResult.ingestionId}</strong>
          </p>
        )}

        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
            <h4 style={{ margin: 0, color: "var(--text-color)", fontSize: "14px" }}>Recent Bill Uploads</h4>
            <button
              type="button"
              onClick={fetchRecentIngestions}
              disabled={ingestionsLoading}
              style={{
                border: "1px solid var(--border-color)",
                background: "transparent",
                color: "var(--text-color)",
                borderRadius: "6px",
                padding: "0.3rem 0.6rem",
                fontSize: "12px",
                cursor: ingestionsLoading ? "not-allowed" : "pointer",
                opacity: ingestionsLoading ? 0.6 : 1
              }}
            >
              {ingestionsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {ingestionsError && (
            <p style={{ margin: "0.5rem 0 0 0", color: "#d9534f", fontSize: "12px" }}>
              Failed to load recent uploads: {ingestionsError}
            </p>
          )}

          {!ingestionsError && recentIngestions.length === 0 && !ingestionsLoading && (
            <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)", fontSize: "12px" }}>
              No uploads recorded yet.
            </p>
          )}

          {!ingestionsError && recentIngestions.length > 0 && (
            <div style={{ marginTop: "0.5rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Received</th>
                    <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Source</th>
                    <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Ingestion ID</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIngestions.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                        {new Date(row.received_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                        {(row.source_type || "manual_upload").replaceAll("_", " ")}
                      </td>
                      <td style={{
                        padding: "6px",
                        borderBottom: "1px solid var(--border-color)",
                        color: row.status === "failed" ? "#d9534f" : "#28a745",
                        fontWeight: 600,
                        textTransform: "capitalize"
                      }}>
                        {row.status || "unknown"}
                      </td>
                      <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        {row.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {bulkUploadResults.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "13px", color: "var(--text-color)" }}>Last Bulk Upload Result</h4>
              <div style={{ maxHeight: "160px", overflow: "auto", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>File</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Result</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkUploadResults.map((result) => (
                      <tr key={`${result.fileName}-${result.status}-${result.ingestionId || "none"}`}>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{result.fileName}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: result.ok ? "#28a745" : result.status === 409 ? "#d39e00" : "#d9534f", fontWeight: 600 }}>
                          {result.ok ? "Uploaded" : result.status === 409 ? "Duplicate" : "Failed"}
                        </td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                          {result.ingestionId ? `Ingestion: ${result.ingestionId}` : result.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <h4 style={{ margin: 0, color: "var(--text-color)", fontSize: "14px" }}>Backfill Reconciliation</h4>
              <button
                type="button"
                onClick={fetchBackfillReconciliation}
                disabled={reconciliationLoading}
                style={{
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "var(--text-color)",
                  borderRadius: "6px",
                  padding: "0.3rem 0.6rem",
                  fontSize: "12px",
                  cursor: reconciliationLoading ? "not-allowed" : "pointer",
                  opacity: reconciliationLoading ? 0.6 : 1
                }}
              >
                {reconciliationLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {reconciliationError && (
              <p style={{ margin: "0.5rem 0 0 0", color: "#d9534f", fontSize: "12px" }}>
                Failed to load reconciliation: {reconciliationError}
              </p>
            )}

            {!reconciliationError && reconciliationData?.totals && (
              <p style={{ margin: "0.5rem 0", color: "var(--text-secondary)", fontSize: "12px" }}>
                Year {reconciliationData.year}: Uploaded {reconciliationData.totals.uploadedDocs}, CEB Records {reconciliationData.totals.cebRecords}, Delta {reconciliationData.totals.delta}
              </p>
            )}

            {!reconciliationError && reconciliationData?.months?.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Month</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Uploaded</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Received</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Failed</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>CEB Rows</th>
                      <th style={{ textAlign: "left", padding: "6px", borderBottom: "1px solid var(--border-color)" }}>Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationData.months.map((month) => (
                      <tr key={month.month}>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{month.month}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{month.uploadedDocs}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "#28a745" }}>{month.received}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: month.failed > 0 ? "#d9534f" : "var(--text-secondary)" }}>{month.failed}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{month.cebRecords}</td>
                        <td style={{ padding: "6px", borderBottom: "1px solid var(--border-color)", color: month.delta === 0 ? "#28a745" : "#d39e00", fontWeight: 600 }}>{month.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Component - Hidden during in-line edit to focus context */}
      {!editingId && (
        <CebForm
          form={form}
          onFormChange={setForm}
          onSubmit={handleSubmit}
          loading={loading}
        />
      )}

      {/* Table Component */}
      {loading && allData.length === 0 ? (
        <SkeletonLoader count={8} variant="table" />
      ) : (
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
          editingId={editingId}
          editForm={form}
          onEditFormChange={setForm}
          onSaveEdit={handleSubmit}
          onCancelEdit={() => {
            setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "" });
            setEditingId(null);
          }}
        />
      )}

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
