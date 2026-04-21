import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ThemeContext } from "./ThemeContext";
import { AuthContext } from "../contexts/AuthContext";
import { AdminThemeContext, adminColorPresets } from "../contexts/AdminThemeContext";
import { LogOut, User } from "lucide-react";
import { adminTheme, getAdminTheme } from "./admin/adminTheme";

// --- SVG Icons ---
const DashboardIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SunIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const LockIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const DevToolsIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="5.5" width="15" height="12" rx="2" />
    <path d="M8 19h8" />
    <path d="M10 9.5l-2.5 2.5L10 14.5" />
    <path d="M14 9.5l2.5 2.5L14 14.5" />
    <circle cx="17.5" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

function Sidebar({ onDevToolsToggle }) {
  const devtoolsEnabled = (import.meta?.env?.VITE_ENABLE_DEVTOOLS ?? "true") === "true";
  const { theme, setTheme } = useContext(ThemeContext);
  const { session, signOut, user, isAdmin } = useContext(AuthContext);
  const { selectedTheme, updateTheme } = useContext(AdminThemeContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const menuRef = useRef(null);

  // Get the current theme colors
  const currentTheme = getAdminTheme(adminColorPresets[selectedTheme]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleAdminAccess = () => {
    setShowAdminPopup(true);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/", { state: { from: "dashboard" } });
  };

  const isDashboardRoute =
    location.pathname === "/" ||
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/dashboard/") ||
    location.pathname === "/demodashbaard" ||
    location.pathname.startsWith("/demodashbaard/");

  return (
    <>
      <style>{`
        .sidebar {
          width: 60px;
          height: 100vh;
          background-color: var(--sidebar-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 1.5rem;
          border-right: 1px solid var(--border-color);
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1000;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 2rem;
        }

        .sidebar-nav a,
        .sidebar-nav button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          color: var(--text-color);
          border-radius: 0.5rem;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s ease;
        }

        .sidebar-nav a:hover,
        .sidebar-nav button:hover,
        .sidebar-nav a.active {
          background-color: transparent;
          color: var(--accent);
        }

        .sidebar-logo {
          font-size: 2rem;
          color: var(--text-color);
          margin-bottom: 2rem;
        }

        .devtools-divider {
          width: 32px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          margin: 2rem 0;
        }

        .devtools-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: transparent;
          color: var(--text-color);
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .devtools-button:hover {
          background-color: transparent;
          color: var(--accent);
          transform: scale(1.05);
        }

        @keyframes adminPortalSlide {
          0% { transform: scale(0.9) translateY(24px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="app-header">
        <h1 style={{ color: "var(--accent)", letterSpacing: "-0.5px" }}>SolarEdge</h1>

        {user && (
          <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button
              onClick={() => setShowUserMenu((value) => !value)}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,122,0,0.3)",
                background: showUserMenu ? "rgba(255,122,0,0.2)" : "rgba(255,122,0,0.1)",
                color: showUserMenu ? "#fff" : "var(--text-color)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              <User size={18} />
              <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email?.split("@")[0] || "User"}
              </span>
            </button>

            {showUserMenu && (
              <div style={{ position: "absolute", top: "46px", right: 0, width: "280px", background: "var(--navbar-bg)", backdropFilter: "blur(20px)", border: "1px solid var(--border-color)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden", zIndex: 1000 }}>
                <div style={{ padding: "20px", borderBottom: "1px solid var(--border-color)", background: "rgba(255,122,0,0.05)" }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-color)", marginBottom: "4px", wordBreak: "break-word" }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success-color)", display: "inline-block" }} />
                    {isAdmin ? "Admin Access" : "Real Dashboard Access"}
                  </div>
                </div>
                <button onClick={handleLogout} style={{ width: "100%", padding: "14px 20px", background: "transparent", border: "none", color: "var(--error-color)", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", textAlign: "left" }}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="sidebar-logo" />
        <nav className="sidebar-nav">
          <NavLink to="/" end title="Dashboard" className={({ isActive }) => (isActive || isDashboardRoute ? "active" : undefined)}>
            <DashboardIcon />
          </NavLink>
          <NavLink to="/settings" title="Settings">
            <SettingsIcon />
          </NavLink>
          <button onClick={toggleTheme} title={theme === "dark" ? "Light Mode" : "Dark Mode"} aria-label="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={handleAdminAccess} title="Admin Access" aria-label="Admin access">
            <LockIcon />
          </button>
        </nav>

        {devtoolsEnabled && <div className="devtools-divider" />}
        {devtoolsEnabled && (
          <button className="devtools-button" onClick={() => onDevToolsToggle?.()} title="Toggle Dev Tools" aria-label="Toggle Dev Tools">
            <DevToolsIcon />
          </button>
        )}
      </div>

      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: currentTheme.gradients.backdrop,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(14px)",
            padding: "1rem",
            animation: "portalFadeIn 0.25s ease-out",
          }}
          onClick={() => setShowAdminPopup(false)}
        >
          <div
            style={{
              background: currentTheme.gradients.surface,
              borderRadius: "14px",
              padding: "clamp(1.2rem, 3vw, 1.8rem)",
              color: currentTheme.colors.text,
              maxWidth: "680px",
              width: "100%",
              boxShadow: currentTheme.shadows.panel,
              border: `1px solid ${currentTheme.colors.borderStrong}`,
              animation: "adminPortalSlide 0.45s ease-out",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: "absolute",
              inset: 0,
              background: currentTheme.gradients.grid,
              opacity: 0.18,
              pointerEvents: "none"
            }} />

            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: currentTheme.colors.danger }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: currentTheme.colors.warning }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: currentTheme.colors.success }} />
                <span style={{ marginLeft: "0.6rem", fontFamily: currentTheme.fonts.mono, fontSize: "12px", color: currentTheme.colors.textMuted }}>
                  root@solar-edge:~$ admin-entry --secure
                </span>
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: `1px solid ${currentTheme.colors.borderStrong}`,
                background: "rgba(0,0,0,0.35)",
                borderRadius: "10px",
                padding: "0.8rem 0.9rem",
                marginBottom: "1rem"
              }}>
                <div>
                  <div style={{ fontFamily: currentTheme.fonts.mono, fontSize: "11px", color: currentTheme.colors.accent, letterSpacing: "1px" }}>
                    AUTH_GATEWAY
                  </div>
                  <div style={{ fontFamily: currentTheme.fonts.mono, fontSize: "18px", fontWeight: 700, color: currentTheme.colors.text }}>
                    DEVELOPER CONTROL ENTRY
                  </div>
                </div>
                <div style={{ fontFamily: currentTheme.fonts.mono, fontSize: "11px", color: currentTheme.colors.textMuted, textAlign: "right" }}>
                  SESSION: {String(user?.email || "guest").split("@")[0].toUpperCase()}<br />
                  NODE: PROD-AUTH-01
                </div>
              </div>

            {isAdmin ? (
              <>
                <div style={{ border: `1px solid ${currentTheme.colors.border}`, borderRadius: "10px", background: "rgba(9,20,42,0.52)", marginBottom: "1rem", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", fontFamily: currentTheme.fonts.mono, fontSize: "12px" }}>
                    <div style={{ padding: "0.65rem 0.8rem", color: currentTheme.colors.textMuted, borderRight: `1px solid ${currentTheme.colors.border}`, borderBottom: `1px solid ${currentTheme.colors.border}` }}>AUTH_ROLE</div>
                    <div style={{ padding: "0.65rem 0.8rem", color: "#93c5fd", borderBottom: `1px solid ${currentTheme.colors.border}` }}>ROOT_ADMIN</div>
                    <div style={{ padding: "0.65rem 0.8rem", color: currentTheme.colors.textMuted, borderRight: `1px solid ${currentTheme.colors.border}`, borderBottom: `1px solid ${currentTheme.colors.border}` }}>TOKEN_STATE</div>
                    <div style={{ padding: "0.65rem 0.8rem", color: "#93c5fd", borderBottom: `1px solid ${currentTheme.colors.border}` }}>VERIFIED</div>
                    <div style={{ padding: "0.65rem 0.8rem", color: currentTheme.colors.textMuted, borderRight: `1px solid ${currentTheme.colors.border}` }}>CAPABILITIES</div>
                    <div style={{ padding: "0.65rem 0.8rem", color: currentTheme.colors.text }}>USER_MGMT, CONFIG_WRITE, METRICS_READ</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAdminPopup(false);
                    navigate("/admin/dashboard");
                  }}
                  style={{
                    width: "100%",
                    background: currentTheme.gradients.accent,
                    color: currentTheme.colors.text,
                    border: `1px solid ${currentTheme.colors.borderStrong}`,
                    padding: "12px 14px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    letterSpacing: "0.9px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    marginBottom: "0.6rem",
                    fontFamily: currentTheme.fonts.mono,
                    boxShadow: currentTheme.shadows.glow
                  }}
                >
                  [ EXEC ./admin-dashboard --mode=control ]
                </button>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.03)",
                    color: currentTheme.colors.textMuted,
                    border: `1px solid ${currentTheme.colors.border}`,
                    padding: "11px 14px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    fontFamily: currentTheme.fonts.mono,
                    letterSpacing: "0.8px",
                    marginBottom: "1.5rem"
                  }}
                >
                  [ ABORT ]
                </button>

                {/* Color Palette Selector - Moved to end and shrunk */}
                <div style={{ 
                  marginTop: "0.5rem", 
                  padding: "0.4rem 0.6rem", 
                  background: "rgba(0,0,0,0.2)", 
                  border: `1px solid ${currentTheme.colors.border}`,
                  borderRadius: "2px"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "0.4rem"
                  }}>
                    <div style={{ fontFamily: currentTheme.fonts.mono, fontSize: "8px", color: currentTheme.colors.accent, letterSpacing: "1px", textTransform: "uppercase" }}>
                      SYS_COLOR_CONFIG
                    </div>
                    <div style={{ fontFamily: currentTheme.fonts.mono, fontSize: "8px", color: currentTheme.colors.textMuted, opacity: 0.5 }}>
                      ID: {selectedTheme.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-start" }}>
                    {Object.entries(adminColorPresets).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => updateTheme(key)}
                        title={preset.name}
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "1px",
                          background: preset.hex,
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: selectedTheme === key ? `0 0 4px ${preset.hex}` : "none",
                          opacity: selectedTheme === key ? 1 : 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Tech Metadata Flair */}
                <div style={{ 
                  marginTop: "1rem", 
                  paddingTop: "0.5rem", 
                  borderTop: `1px dashed ${currentTheme.colors.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: currentTheme.fonts.mono,
                  fontSize: "9px",
                  color: "rgba(255,255,255,0.2)"
                }}>
                  <div>ULID: 01H6...{Math.random().toString(36).substring(7).toUpperCase()}</div>
                  <div style={{ color: currentTheme.colors.success }}>MEM_LOCAL: 42.8MB</div>
                  <div>SEC_LAYER: V3_RSA</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ border: `1px solid ${currentTheme.colors.borderStrong}`, borderRadius: "10px", background: "rgba(17,35,68,0.4)", padding: "0.9rem", marginBottom: "0.9rem", fontFamily: currentTheme.fonts.mono }}>
                  <div style={{ fontSize: "12px", color: currentTheme.colors.accent, letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
                    AUTHORIZATION_FAILED
                  </div>
                  <div style={{ fontSize: "12px", color: currentTheme.colors.textMuted, marginTop: "0.45rem" }}>
                    Admin claim missing in current identity token. Contact platform owner for role escalation.
                  </div>
                </div>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    color: currentTheme.colors.textMuted,
                    border: `1px solid ${currentTheme.colors.border}`,
                    padding: "11px 14px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    fontFamily: currentTheme.fonts.mono,
                    letterSpacing: "0.8px",
                  }}
                >
                  [ CLOSE ]
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes adminPortalSlide {
          0% {
            transform: scale(0.8) translateY(50px);
            opacity: 0;
            filter: blur(10px);
          }
          50% {
            transform: scale(1.05) translateY(-8px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
            filter: blur(0);
          }
        }
        
        @keyframes portalFadeIn {
          0% {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          100% {
            opacity: 1;
            backdrop-filter: blur(25px);
          }
        }

        @keyframes gridShift {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(40px);
          }
        }
        
        @keyframes techGlow {
          0%, 100% {
            transform: translateX(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes techGlowAdvanced {
          0% {
            transform: translateX(-100%) translateY(-50%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%) translateY(50%);
            opacity: 0;
          }
        }

        @keyframes scanlines {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(4px);
          }
        }

        @keyframes techPulse {
          0%, 100% {
            opacity: 0.6;
            text-shadow: 0 0 10px rgba(0,212,170,0.3);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 20px rgba(0,212,170,0.7);
          }
        }

        @keyframes techLineFlow {
          0% {
            height: 0%;
          }
          50% {
            height: 100%;
          }
          100% {
            height: 0%;
          }
        }

        @keyframes techSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes techSpinReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </>
  );
}

// --- Layout wrapper ---
export function AppLayout({ children, onDevToolsToggle }) {
  return (
    <>
      <Sidebar onDevToolsToggle={onDevToolsToggle} />
      <main style={{ marginLeft: "80px", padding: "2rem" }}>
        {children}
      </main>
    </>
  );
}

export default Sidebar;
