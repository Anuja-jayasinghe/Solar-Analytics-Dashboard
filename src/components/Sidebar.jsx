import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ThemeContext } from "./ThemeContext";
import { AuthContext } from "../contexts/AuthContext";
import { LogOut, User } from "lucide-react";

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
  const { signOut, user, isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

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

        .logo-brand {
          font-size: clamp(1.25rem, 3.5vw, 1.45rem);
          margin: 0;
          display: flex;
          align-items: center;
          font-family: 'Outfit', 'Inter', sans-serif;
          letter-spacing: -0.04em;
          line-height: 1;
          user-select: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .logo-brand:hover {
          transform: translateY(-1px);
          filter: drop-shadow(0 4px 12px rgba(255, 110, 0, 0.25));
        }

        .logo-solar {
          background: linear-gradient(135deg, #ffb700 0%, #ff5500 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 900;
          text-transform: uppercase;
        }

        .logo-edge {
          background: linear-gradient(135deg, #ff8800 0%, #ff3300 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 300;
          text-transform: uppercase;
          letter-spacing: 0.01em;
        }

        .logo-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10b981; /* Vibrant green accent */
          margin-left: 3px;
          margin-top: 6px;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4), 0 0 10px rgba(16, 185, 129, 0.2);
          animation: pulseGlow 2s infinite ease-in-out;
        }

        @keyframes pulseGlow {
          0%, 100% { 
            opacity: 0.4; 
            transform: scale(0.8); 
            box-shadow: 0 0 4px rgba(16, 185, 129, 0.4); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.2); 
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.8), 0 0 14px rgba(16, 185, 129, 0.4); 
          }
        }
      `}</style>

      <div className="app-header">
        <h1 className="logo-brand">
          <span className="logo-solar">Solar</span>
          <span className="logo-edge">Edge</span>
          <span className="logo-dot" />
        </h1>

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

        <div style={{
          marginTop: 'auto',
          marginBottom: '1rem',
          fontSize: '9px',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--text-secondary)',
          opacity: 0.4,
          cursor: 'default',
          userSelect: 'none',
          textAlign: 'center',
          fontWeight: 'bold',
          letterSpacing: '0.5px'
        }} title="Solar Analytics Dashboard Release">
          v2.0.0
        </div>
      </div>

      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
            padding: "1rem",
          }}
          onClick={() => setShowAdminPopup(false)}
        >
          <div
            style={{
              background: 'var(--card-bg-solid)',
              borderRadius: "16px",
              padding: "1.5rem",
              color: 'var(--text-color)',
              maxWidth: "420px",
              width: "100%",
              boxShadow: '0 8px 32px var(--card-shadow)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent)', fontSize: '18px' }}>
              Admin Access
            </h3>

            {isAdmin ? (
              <>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  background: 'var(--card-bg)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}>
                  Signed in as <strong style={{ color: 'var(--text-color)' }}>{user?.email}</strong> with administrator privileges.
                </div>

                <button
                  onClick={() => {
                    setShowAdminPopup(false);
                    navigate("/admin/dashboard");
                  }}
                  style={{
                    width: "100%",
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    padding: "12px 14px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "0.6rem",
                    fontSize: '14px'
                  }}
                >
                  Go to Admin Dashboard
                </button>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: "11px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  background: 'var(--card-bg)',
                  padding: '0.9rem',
                  marginBottom: '0.9rem',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}>
                  Your account doesn't have administrator access. Contact the site owner if you believe this is a mistake.
                </div>

                <button
                  onClick={() => setShowAdminPopup(false)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: "11px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: '14px'
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
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
