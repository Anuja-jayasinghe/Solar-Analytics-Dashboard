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
  const [selectedBillFiles, setSelectedBillFiles] = useState([]);
  const [uploadResults, setUploadResults] = useState(null); // null = no batch yet; array = per-file results
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total, phase, fileName }
  const [storageFiles, setStorageFiles] = useState([]);
  const [isStorageCollapsed, setIsStorageCollapsed] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [form, setForm] = useState({
    bill_date: "",
    meter_reading: "",
    units_exported: "",
    earnings: "",
    account_number: "",
    billing_month: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rate, setRate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
    if (!selectedBillFiles || selectedBillFiles.length === 0) {
      setMessage('❌ Please choose at least one file to upload.');
      return;
    }

    setUploading(true);
    setUploadResults([]);      // show panel immediately — results grow live
    setUploadProgress(null);
    setMessage('');

    const total = selectedBillFiles.length;

    // Helper: append one result to the live list
    const pushResult = (result) =>
      setUploadResults(prev => [...(prev || []), result]);

    try {
      for (let i = 0; i < total; i++) {
        const file = selectedBillFiles[i];

        // ── Pre-flight: size check ───────────────────────────────────────────
        if (file.size > 10 * 1024 * 1024) {
          pushResult({
            fileName: file.name,
            status: 'too_large',
            message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — exceeds the 10 MB limit.`
          });
          continue;
        }

        // ── Re-fetch token every file (Clerk rotates tokens; stale token = 401) ──
        setUploadProgress({ current: i + 1, total, phase: 'Uploading', fileName: file.name });
        const token = await fetchAuthToken();
        if (!token) {
          pushResult({
            fileName: file.name,
            status: 'upload_failed',
            message: 'Authentication expired — please refresh the page and try again.'
          });
          continue;
        }

        // ── Step 1: Upload ───────────────────────────────────────────────────
        const { ok, status, payload } = await uploadSingleFile(file, token);

        if (!ok) {
          if (status === 409) {
            pushResult({
              fileName: file.name,
              status: 'duplicate',
              message: 'Already in system — not re-uploaded.',
              ingestionId: payload.ingestionId,
              existingStatus: payload.status
            });
          } else {
            pushResult({
              fileName: file.name,
              status: 'upload_failed',
              message: payload.error || payload.details || `Upload failed (HTTP ${status})`
            });
          }
          continue;
        }

        // ── Step 2: Parse ────────────────────────────────────────────────────
        setUploadProgress({ current: i + 1, total, phase: 'Parsing', fileName: file.name });
        try {
          const extRes = await fetch('/api/ceb-bills/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ingestionId: payload.ingestionId })
          });
          const extData = await extRes.json().catch(() => ({}));

          if (!extRes.ok) throw new Error(extData.error || `Parser returned HTTP ${extRes.status}`);

          const reviewStatus = extData.extraction?.review_status;
          const confidence   = extData.extraction?.confidence_score;
          const valErrors    = extData.extraction?.validation_errors || [];
          const isAutoOk     = reviewStatus === 'auto_approved';

          pushResult({
            fileName: file.name,
            status: isAutoOk ? 'auto_approved' : 'needs_review',
            message: isAutoOk
              ? 'Parsed successfully — check the Review Queue to approve.'
              : 'Parsed with warnings — review before approving.',
            ingestionId: payload.ingestionId,
            validationErrors: valErrors,
            confidence
          });
        } catch (extErr) {
          pushResult({
            fileName: file.name,
            status: 'parse_failed',
            message: extErr.message || 'Parser could not extract data. Use "Retry Parsing" from the queue.',
            ingestionId: payload.ingestionId
          });
        }
      }

      setSelectedBillFiles([]);
      setMessage('');
      fetchStorageFiles();
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('CEB bill upload error:', err);
      setMessage(`❌ ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
        account_number: form.account_number || null,
        billing_month: form.billing_month || null,
        data_source: editingId ? undefined : 'manual_entry'
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
        // insert new with upsert check
        const { error } = await supabase
            .from("ceb_data")
            .upsert([recordData], { onConflict: 'account_number, billing_month' });
            
        if (error) throw error;
        setMessage("✅ Record added successfully (Synced).");
      }

      setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "", account_number: "", billing_month: "" });
      setEditingId(null);
      fetchData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Preview PDF File
  const handlePreview = async (filePath) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const { data, error } = await supabase
        .storage
        .from('ceb_bills')
        .createSignedUrl(filePath, 300); // 5 minutes expiry

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (err) {
      setMessage(`❌ Error loading preview: ${err.message}`);
      console.error("Preview error:", err);
      setPreviewLoading(false);
    }
  };

  // ✅ Ask confirmation before delete
  const requestDelete = (record) => {
    setDeleteTarget(record);
    setConfirmOpen(true);
  };

  // ✅ Delete confirmed
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);

    try {
      const token = await fetchAuthToken();
      const response = await fetch('/api/ceb-bills/delete-record', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recordId: deleteTarget.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete record.');
      }

      setMessage("✅ Record and associated files permanently deleted.");
      fetchData();
      fetchStorageFiles();
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      setMessage(`❌ Error deleting record: ${err.message}`);
      console.error("Delete error:", err);
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
      account_number: record.account_number || "",
      billing_month: record.billing_month || "",
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
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setSelectedBillFiles(Array.from(e.target.files || []))}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={handleBillUpload}
            disabled={uploading || selectedBillFiles.length === 0}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "0.6rem 1rem",
              cursor: uploading || selectedBillFiles.length === 0 ? "not-allowed" : "pointer",
              opacity: uploading || selectedBillFiles.length === 0 ? 0.7 : 1
            }}
          >
            {uploading ? "Uploading..." : `Upload ${selectedBillFiles.length > 1 ? 'Files' : 'Bill'}`}
          </button>
        </div>

        {selectedBillFiles.length > 0 && (
          <p style={{ margin: "0.75rem 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
            Selected: <strong>{selectedBillFiles.length} file(s)</strong> (
            {(selectedBillFiles.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB total)
          </p>
        )}

        {/* ── Batch Upload Results Panel — shows live during upload and after ── */}
        {(uploading || (uploadResults && uploadResults.length > 0)) && (() => {
          const STATUS_CONFIG = {
            auto_approved: { icon: '✅', color: '#4caf50', label: 'Parsed & Ready' },
            needs_review:  { icon: '⚠️', color: '#ff9800', label: 'Needs Review'  },
            parse_failed:  { icon: '❌', color: '#f44336', label: 'Parse Failed'  },
            duplicate:     { icon: '🔁', color: '#2196f3', label: 'Duplicate'     },
            upload_failed: { icon: '❌', color: '#f44336', label: 'Upload Failed' },
            too_large:     { icon: '⚠️', color: '#ff9800', label: 'Too Large'     }
          };
          const done       = uploadResults?.length || 0;
          const processed  = uploadResults?.filter(r => ['auto_approved', 'needs_review'].includes(r.status)).length || 0;
          const duplicates = uploadResults?.filter(r => r.status === 'duplicate').length || 0;
          const failed     = uploadResults?.filter(r => ['upload_failed', 'parse_failed', 'too_large'].includes(r.status)).length || 0;
          const pct        = uploadProgress ? Math.round(((uploadProgress.current - 1) / uploadProgress.total) * 100) : 100;

          return (
            <div style={{ marginTop: '1rem', border: `1px solid ${uploading ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.3s' }}>

              {/* ── Live progress bar (visible only while uploading) ── */}
              {uploading && uploadProgress && (
                <div style={{ padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-color)', fontWeight: '500' }}>
                      ⏳ {uploadProgress.phase} file {uploadProgress.current} of {uploadProgress.total}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {uploadProgress.fileName}
                    </span>
                  </div>
                  {/* Progress track */}
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'var(--accent)',
                      borderRadius: '3px',
                      transition: 'width 0.35s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{done} of {uploadProgress.total} files settled</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{pct}%</span>
                  </div>
                </div>
              )}

              {/* ── Header: summary badges ── */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderBottom: uploadResults?.length ? '1px solid var(--border-color)' : 'none',
                padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-color)', fontSize: '13px' }}>
                    {uploading ? '📥 Processing…' : '📋 Batch Results'}
                    {uploadProgress && uploading && <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '4px', fontSize: '11px' }}>({uploadProgress.total} files)</span>}
                    {!uploading && uploadResults && <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '4px', fontSize: '11px' }}>({uploadResults.length} file{uploadResults.length !== 1 ? 's' : ''})</span>}
                  </span>
                  {processed > 0 && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: 'rgba(76,175,80,0.15)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)' }}>{processed} processed</span>}
                  {duplicates > 0 && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: 'rgba(33,150,243,0.15)', color: '#2196f3', border: '1px solid rgba(33,150,243,0.3)' }}>{duplicates} duplicate</span>}
                  {failed > 0 && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: 'rgba(244,67,54,0.15)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)' }}>{failed} failed</span>}
                </div>
                {!uploading && (
                  <button onClick={() => setUploadResults(null)} title="Dismiss" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>×</button>
                )}
              </div>

              {/* ── Per-file result rows (grow in real time) ── */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {(uploadResults || []).map((result, i) => {
                  const cfg = STATUS_CONFIG[result.status] || { icon: '❓', color: 'var(--text-secondary)', label: result.status };
                  return (
                    <div key={i} style={{
                      padding: '0.5rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                      animation: 'fadeInRow 0.25s ease'
                    }}>
                      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>{cfg.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-color)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{result.fileName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {result.confidence != null && (
                              <span style={{ fontSize: '10px', color: result.confidence >= 80 ? '#4caf50' : '#ff9800' }}>{result.confidence}% confidence</span>
                            )}
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44`, fontWeight: 'bold' }}>{cfg.label}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{result.message}</div>
                        {result.validationErrors?.length > 0 && (
                          <div style={{ marginTop: '3px' }}>
                            {result.validationErrors.map((err, ei) => <div key={ei} style={{ fontSize: '10px', color: '#ff9800', marginTop: '1px' }}>• {err}</div>)}
                          </div>
                        )}
                        {result.status === 'duplicate' && result.existingStatus && (
                          <div style={{ fontSize: '10px', color: '#2196f3', marginTop: '2px' }}>Existing record status: <strong>{result.existingStatus.replace(/_/g, ' ')}</strong></div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* ── Spinner row: shows while more files are still processing ── */}
                {uploading && uploadProgress && (
                  <div style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: done > 0 ? '1px solid var(--border-color)' : 'none', opacity: 0.7 }}>
                    <span style={{ fontSize: '14px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {uploadProgress.phase} <em>{uploadProgress.fileName}</em>…
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
      {loading ? (
          <SkeletonLoader rows={5} />
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
            onPreview={handlePreview}
            loading={loading}
            editingId={editingId}
            editForm={form}
            onEditFormChange={setForm}
            onSaveEdit={handleSubmit}
            onCancelEdit={() => {
              setForm({ bill_date: "", meter_reading: "", units_exported: "", earnings: "", account_number: "", billing_month: "" });
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
        message={
          deleteTarget?.data_source !== 'manual_entry'
            ? "This action cannot be undone. Are you sure you want to delete this CEB record? This will permanently delete the record AND the associated PDF bill from storage."
            : "This action cannot be undone. Are you sure you want to delete this manually entered CEB record?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={loading}
        isDangerous={true}
      />

      {/* File Preview Modal */}
      {(previewLoading || previewUrl) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '900px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: 0, color: 'var(--text-color)', fontSize: '16px' }}>📄 Document Preview</h3>
              <button 
                onClick={() => { setPreviewUrl(null); setPreviewLoading(false); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ flex: 1, position: 'relative', background: '#e0e0e0' }}>
              {!previewUrl && previewLoading ? (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#333' }}>
                  Loading secure document link...
                </div>
              ) : (
                <iframe 
                  src={previewUrl} 
                  title="Document Preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  onLoad={() => setPreviewLoading(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CebDataManagement;
