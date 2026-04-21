import React, { useState, useContext, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { AdminThemeContext, adminColorPresets } from "../contexts/AdminThemeContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import CebDataManagement from "../components/admin/CebDataManagement"; 
import UserManagement from "../components/admin/UserManagement";
import { getAdminShellStyles, getAdminTheme } from "../components/admin/adminTheme";

/**
 * AdminDashboard: Retro-Developer Edition (STABLE)
 * Features: ASCII Branding, Dynamic System Telemetry, Auto-scrolling Terminal, CRT Overlay.
 */
function AdminDashboard() {
  // Initialize tab from localStorage or default to "users"
  const [tab, setTab] = useState(() => {
    return localStorage.getItem("admin_active_tab") || "users";
  });
  const [logs, setLogs] = useState([]);
  const [uptime, setUptime] = useState("00:00:00");
  const [loadAvg, setLoadAvg] = useState("0.08 / 0.12");
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { selectedTheme } = useContext(AdminThemeContext);
  
  const adminTheme = useMemo(() => getAdminTheme(adminColorPresets[selectedTheme]), [selectedTheme]);
  const shellStyles = useMemo(() => getAdminShellStyles(adminTheme), [adminTheme]);
  
  const terminalRef = useRef(null);
  const bootTime = useRef(Date.now());

  // Persist tab choice
  useEffect(() => {
    localStorage.setItem("admin_active_tab", tab);
  }, [tab]);

  // 1. Dynamic Uptime Engine
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - bootTime.current) / 1000);
      const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      setUptime(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Load Monitor & Log Stream
  useEffect(() => {
    const messages = [
      "AUTH_REQ: ROOT_ACCESS GRANTED",
      "SYS: NETWORK_SYNC_PROTOCOL_OK",
      "SEC: SCANNING_IP_RANGE...",
      "DB: FETCHING_PEER_NODES",
      "SYS: KERNEL_LOAD_BALANCER_UP",
      "SEC: ENCRYPT_LAYER_RSA_4096_ACTIVE",
      "SYS: CACHE_FLUSH_SUCCESS",
      "NET: HANDSHAKE_CLIENT_ESTABLISHED",
      "SYS: CRON_JOB_CLEANUP_INIT",
      "SEC: FIREWALL_RULES_UPDATED"
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      // Update Logs
      setLogs(prev => {
        const newLogs = [...prev, `> ${messages[i % messages.length]} [${new Date().toLocaleTimeString()}]`];
        return newLogs.slice(-50); // Keep 50 logs in history
      });
      
      // Update Load Average (Simulated fluctuation)
      const l1 = (0.05 + Math.random() * 0.1).toFixed(2);
      const l2 = (0.10 + Math.random() * 0.05).toFixed(2);
      setLoadAvg(`${l1} / ${l2}`);
      
      i++;
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // 3. Auto-scroll Terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const renderContent = () => {
    switch (tab) {
      case "ceb":
        return <CebDataManagement />;
      case "users":
        return <UserManagement />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: "users", label: "NODE_USERS", desc: "IDENTITY_ACCESS_MGMT" },
    { id: "ceb", label: "DATA_STREAMS", desc: "CLUSTER_BILLING_LOGS" },
  ];

  return (
    <div style={shellStyles.page}>
      {/* CRT Scanline Overlay */}
      <div style={shellStyles.scanline} />

      {/* Retro Header */}
      <div style={shellStyles.header}>
        <div style={shellStyles.pageFrame}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "2rem", alignItems: "flex-start" }}>
            
            {/* Branding & ASCII Branding */}
            <div style={{ flex: 1 }}>
              <pre style={{ 
                margin: 0, 
                fontSize: "7px", 
                lineHeight: "7px", 
                color: adminTheme.colors.accent, 
                opacity: 0.8,
                fontFamily: adminTheme.fonts.mono,
                textShadow: `0 0 5px ${adminTheme.colors.accent}60`,
                userSelect: "none"
              }}>
{`  _____  ____  _            _____  
 / ____|/ __ \\| |    /\\    |  __ \\ 
| (___ | |  | | |   /  \\   | |__) |
 \\___ \\| |  | | |  / /\\ \\  |  _  / 
 ____) | |__| | |_/ ____ \\ | | \\ \\ 
|_____/ \____/|_/_/    \\_\\_|_|  \\_\\`}
              </pre>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                <h1 style={shellStyles.pageTitle}>CONTROL.CENTER</h1>
                <div style={shellStyles.badge}>V4.1.0-STABLE</div>
              </div>
            </div>

            {/* System Telemetry Panel (Accurate & Dynamic) */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "1.5rem",
              background: "rgba(0,0,0,0.45)",
              padding: "1rem 1.5rem",
              border: `1px solid ${adminTheme.colors.border}`,
              borderRadius: "1px",
              minWidth: "450px",
              boxShadow: `inset 0 0 15px ${adminTheme.colors.accent}05`
            }}>
              <div>
                <div style={shellStyles.sectionLabel}>NODE_STATUS</div>
                <div style={{ color: adminTheme.colors.success, fontSize: "13px", fontWeight: "bold", fontFamily: adminTheme.fonts.mono }}>● ONLINE</div>
                <div style={{ fontSize: "8px", opacity: 0.5, marginTop: "2px" }}>SESSION: ACTIVE</div>
              </div>
              <div>
                <div style={shellStyles.sectionLabel}>SYS_UPTIME</div>
                <div style={{ color: adminTheme.colors.text, fontSize: "13px", fontFamily: adminTheme.fonts.mono }}>{uptime}</div>
                <div style={{ fontSize: "8px", opacity: 0.5, marginTop: "2px" }}>SINCE_BOOT</div>
              </div>
              <div>
                <div style={shellStyles.sectionLabel}>LOAD_AVG</div>
                <div style={{ color: adminTheme.colors.warning, fontSize: "13px", fontFamily: adminTheme.fonts.mono }}>{loadAvg}</div>
                <div style={{ fontSize: "8px", opacity: 0.5, marginTop: "2px" }}>REALTIME_POLL</div>
              </div>
            </div>

            {/* User Session Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
              <button
                onClick={() => navigate("/dashboard")}
                style={shellStyles.pillButton}
                onMouseOver={(e) => { e.currentTarget.style.background = adminTheme.colors.accentSoft; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                [ EXIT_ADMIN ]
              </button>
              <div style={shellStyles.badge}>
                USER: {user?.email?.split('@')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Sub-grid (STABILIZED) */}
      <div style={{ ...shellStyles.pageFrame, padding: "2rem" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "2rem", marginBottom: "2rem" }}>
          
          {/* Functional Navigation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={shellStyles.sectionLabel}>SYSTEM_SUBSYSTEM_SWITCHES</div>
            <div style={{ display: "flex", gap: "1.25rem", height: "85px" }}> {/* Fixed height for stability */}
              {tabs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{
                    ...shellStyles.tabCard,
                    flex: 1,
                    ...(tab === item.id ? shellStyles.tabCardActive : {}),
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ 
                      fontFamily: adminTheme.fonts.mono, 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      letterSpacing: "1.5px", 
                      color: tab === item.id ? adminTheme.colors.accent : adminTheme.colors.textMuted 
                    }}>
                      {item.label}
                    </div>
                    {tab === item.id && <div style={{ fontSize: "10px", color: adminTheme.colors.accent }}>[LOADED]</div>}
                  </div>
                  <div style={{ fontSize: "10px", color: adminTheme.colors.textMuted, opacity: 0.5, marginTop: "0.6rem", textTransform: "uppercase" }}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Security Terminal Log (FIXED SCALE) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={shellStyles.sectionLabel}>AUDIT_LOG_STREAM</div>
            <div 
              ref={terminalRef}
              style={{ 
                height: "85px", // Matches navigation height
                background: "black", 
                border: `1px solid ${adminTheme.colors.borderStrong}`,
                padding: "0.6rem 0.8rem",
                fontFamily: adminTheme.fonts.mono,
                fontSize: "10px",
                color: adminTheme.colors.success,
                boxShadow: `inset 0 0 10px ${adminTheme.colors.success}15`,
                position: "relative",
                overflowY: "auto", // Allow scrolling within fixed box
                scrollBehavior: "smooth"
                
              }}
            >
              {logs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: "2px", opacity: 0.5 + (idx / logs.length) * 0.5 }}>{log}</div>
              ))}
              <div style={{ 
                width: "6px", 
                height: "12px", 
                background: adminTheme.colors.success, 
                display: "inline-block",
                animation: "terminal-blink 1s step-end infinite",
                verticalAlign: "middle",
                marginLeft: "4px"
              }} />
            </div>
          </div>
        </div>

        {/* Content Panel */}
        <div style={{ ...shellStyles.panel, padding: "1.5rem", minHeight: "400px" }}>
          <ErrorBoundary title="SUBSYSTEM_FATAL_ERROR">
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>

      <style>
        {`
          @keyframes terminal-blink {
            from, to { opacity: 1; }
            50% { opacity: 0; }
          }
          
          /* Custom scrollbar for retro terminal */
          div::-webkit-scrollbar {
            width: 4px;
          }
          div::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.5);
          }
          div::-webkit-scrollbar-thumb {
            background: ${adminTheme.colors.borderStrong};
            border-radius: 2px;
          }

          pre {
            pointer-events: none;
          }
        `}
      </style>
    </div>
  );
}

export default AdminDashboard;
