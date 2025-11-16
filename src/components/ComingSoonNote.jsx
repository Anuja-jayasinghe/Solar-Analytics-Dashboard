import React, { useEffect, useState } from "react";

const ComingSoonNote = () => {
  const [hidden, setHidden] = useState(true); // Start hidden, show after mount

  useEffect(() => {
    // Always show on page refresh/mount
    setHidden(false);
  }, []);

  if (hidden) return null;

  // Allow disabling via env var if needed
  const enabled = import.meta?.env?.VITE_SHOW_COMING_SOON ?? "true";
  if (String(enabled).toLowerCase() === "false") return null;

  return (
    <div style={container} role="status" aria-live="polite">
      <div style={badge}>
        <span style={{ fontWeight: 600, marginRight: 6 }}>🚧 Coming soon:</span>
        <span>
          We’re upgrading the dashboard (smarter caching, faster refresh, billing-period accuracy).
        </span>
        <button
          aria-label="Dismiss announcement"
          title="Dismiss"
          onClick={() => setHidden(true)}
          style={closeBtn}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const container = {
  position: "fixed",
  left: 16,
  bottom: 16,
  zIndex: 2000,
  pointerEvents: "none",
};

const badge = {
  pointerEvents: "auto",
  maxWidth: 420,
  color: "#fff",
  lineHeight: 1.3,
  fontSize: "0.9rem",
  background: "linear-gradient(145deg, rgba(20,20,22,0.92), rgba(12,12,14,0.9))",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  padding: "0.75rem 2.25rem 0.75rem 0.85rem",
  boxShadow: "0 8px 28px rgba(0,234,255,0.12), inset 0 1px 1px rgba(255,255,255,0.06)",
  backdropFilter: "blur(10px)",
};

const closeBtn = {
  position: "absolute",
  top: 4,
  right: 6,
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
};

export default ComingSoonNote;
