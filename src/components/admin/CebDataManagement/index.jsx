import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { supabase } from "../../../lib/supabaseClient";
import useTablePagination from "../../../hooks/useTablePagination";
import SkeletonLoader from "../../shared/SkeletonLoader";
import ConfirmDialog from "../../shared/ConfirmDialog";
import CebForm from "./CebForm";
import CebTable from "./CebTable";
import VerificationQueue from "./VerificationQueue";

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
  const [uploadResult, setUploadResult] = useState(null);
  const [storageFiles, setStorageFiles] = useState([]);
  const [isStorageCollapsed, setIsStorageCollapsed] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
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
  const [refreshKey, setRefreshKey] = useState(0);

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
    fetchStorageFiles();
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

  const fetchStorageFiles = async () => {
    setFilesLoading(true);
    setFilesError("");

    try {
      const token = await fetchAuthToken();
      if (!token) throw new Error("No auth token");

      const response = await fetch("/api/ceb-bills/ingestions?limit=100", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(payload.details || payload.error || `Failed with status ${response.status}`);
      }

      setStorageFiles(payload.files || []);
    } catch (err) {
      console.error("CEB storage file list fetch error:", err);
      setFilesError(err.message || "Failed to load storage file list");
    } finally {
      setFilesLoading(false);
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
          fetchStorageFiles();
          return;
        }
        throw new Error(payload.details || payload.error || `Upload failed with status ${status}`);
      }

      setUploadResult(payload);
      setSelectedBillFile(null);
      setMessage("⏳ Bill uploaded! Extracting data using programmatic parser...");
      
      try {
        const extRes = await fetch('/api/ceb-bills/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ ingestionId: payload.ingestionId })
        });
        const extData = await extRes.json();
        if (!extRes.ok) throw new Error(extData.error || 'Failed to extract.');
        setMessage("✅ Bill uploaded and extracted successfully! Please review it in the Parsing Review Queue.");
      } catch (extErr) {
        setMessage(`⚠️ Bill uploaded, but parsing failed: ${extErr.message}. You can retry in the Parsing Review Queue.`);
      }

      fetchStorageFiles();
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("CEB bill upload error:", err);
      setMessage(`❌ ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const [ingestionToDelete, setIngestionToDelete] = useState(null);

  const handleExtractFromStorage = async (ingestionId) => {
    setMessage("⏳ Extracting data...");
    try {
        const token = await fetchAuthToken();
        const extRes = await fetch('/api/ceb-bills/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ ingestionId })
        });
        const extData = await extRes.json();
        if (!extRes.ok) throw new Error(extData.error || 'Failed to extract.');
        setMessage("✅ Extracted successfully! Please review it in the Parsing Review Queue.");
        fetchStorageFiles();
        setRefreshKey(prev => prev + 1);
    } catch (extErr) {
        setMessage(`⚠️ Parsing failed: ${extErr.message}`);
    }
  };

  const handleDeleteIngestion = async (ingestionId) => {
    setMessage("⏳ Deleting file from storage...");
    try {
        const token = await fetchAuthToken();
        const res = await fetch('/api/ceb-bills/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ ingestionId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete.');
        
        setMessage("✅ File and records completely removed from storage.");
        fetchStorageFiles();
        setRefreshKey(prev => prev + 1);
    } catch (err) {
        setMessage(`❌ Failed to delete: ${err.message}`);
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
          <div 
            onClick={() => setIsStorageCollapsed(!isStorageCollapsed)}
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              gap: "0.75rem",
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "10px", opacity: 0.7, transform: isStorageCollapsed ? "none" : "rotate(90deg)", transition: "transform 0.2s" }}>
                {isStorageCollapsed ? "▶" : "▼"}
              </span>
              <h4 style={{ margin: 0, color: "var(--text-color)", fontSize: "14px" }}>
                Files In Storage ({storageFiles.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchStorageFiles();
              }}
              disabled={filesLoading}
              style={{
                border: "1px solid var(--border-color)",
                background: "transparent",
                color: "var(--text-color)",
                borderRadius: "6px",
                padding: "0.3rem 0.6rem",
                fontSize: "12px",
                cursor: filesLoading ? "not-allowed" : "pointer",
                opacity: filesLoading ? 0.6 : 1
              }}
            >
              {filesLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {!isStorageCollapsed && (
            <div style={{ 
              marginTop: "1rem",
              animation: "slideDown 0.2s ease-out"
            }}>
              {filesError && (
                <p style={{ margin: "0.5rem 0 0 0", color: "#d9534f", fontSize: "12px" }}>
                  Failed to load storage files: {filesError}
                </p>
              )}

              {!filesError && storageFiles.length === 0 && !filesLoading && (
                <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)", fontSize: "12px" }}>
                  No files found in storage.
                </p>
              )}

              {!filesError && storageFiles.length > 0 && (
                <div style={{ 
                  marginTop: "0.5rem", 
                  overflowY: "auto", 
                  maxHeight: "250px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  background: "rgba(0,0,0,0.2)"
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--card-bg)", zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Date</th>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>File</th>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Month</th>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Units</th>
                        <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Earnings</th>
                        <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid var(--border-color)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageFiles.map((row) => {
                        const ext = row.extraction || {};
                        const statusColor = 
                          row.status === 'approved' ? '#4caf50' : 
                          row.status === 'pending_review' || row.status === 'auto_approved' ? '#ffc107' :
                          row.status.includes('failed') ? '#f44336' : 'var(--text-secondary)';
                        
                        return (
                          <tr key={row.id}>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: '11px' }}>
                              {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-color)", fontWeight: '500' }}>
                              {row.name}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)" }}>
                               <span style={{ 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  fontSize: '10px', 
                                  textTransform: 'uppercase', 
                                  fontWeight: 'bold',
                                  background: `${statusColor}22`,
                                  color: statusColor,
                                  border: `1px solid ${statusColor}44`
                               }}>
                                  {row.status.replace('_', ' ')}
                               </span>
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "#38bdf8", fontWeight: 'bold' }}>
                              {ext.billing_month || '-'}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "var(--text-color)" }}>
                              {ext.units_exported || '-'}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", color: "#4caf50" }}>
                              {ext.earnings ? `Rs. ${ext.earnings}` : '-'}
                            </td>
                            <td style={{ padding: "8px", borderBottom: "1px solid var(--border-color)", textAlign: "right" }}>
                              {row.status !== 'approved' && (
                                <>
                                  <button onClick={() => handleExtractFromStorage(row.id)} style={{ background: 'transparent', color: '#2196f3', border: '1px solid #2196f3', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', marginRight: '4px', cursor: 'pointer' }}>Parse</button>
                                  <button onClick={() => setIngestionToDelete(row.id)} title="Delete completely to allow re-upload" style={{ background: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Verification Queue (Step 2 & 3) */}
      <VerificationQueue key={refreshKey} onApproveSuccess={fetchData} />

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

      {/* Confirmation Dialog for File Deletion */}
      <ConfirmDialog
        open={!!ingestionToDelete}
        title="Delete Uploaded File"
        message="Are you sure you want to delete this uploaded file? This will completely remove it from the system and allow you to re-upload it if needed."
        confirmText="Delete File"
        cancelText="Cancel"
        onConfirm={() => {
            handleDeleteIngestion(ingestionToDelete);
            setIngestionToDelete(null);
        }}
        onCancel={() => setIngestionToDelete(null)}
        isLoading={false}
        isDangerous={true}
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
