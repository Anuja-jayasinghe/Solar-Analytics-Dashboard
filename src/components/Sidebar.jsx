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
  const devtoolsEnabled = (import.meta?.env?.VITE_ENABLE_DEVTOOLS ?? 'true') === 'true';
  const { theme, setTheme } = useContext(ThemeContext);
  const { session, signOut, user, isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const handleAdminAccess = () => {
    setShowAdminPopup(true);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/', { state: { from: 'dashboard' } });
  };

  const isDashboardRoute =
    location.pathname === '/' ||
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/dashboard/') ||
    location.pathname === '/demodashbaard' ||
    location.pathname.startsWith('/demodashbaard/');

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
          transition: transform 0.3s ease;
        }
        
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 2rem;
        }
        
        .sidebar-nav a {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          color: var(--text-color);
          border-radius: 0.5rem;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        
        .sidebar-nav a:hover {
          background-color: transparent;
          color: var(--accent);
        }

        .sidebar-nav a.active {
          background-color: transparent;
          color: var(--accent);
        }

        .sidebar-nav a:hover svg,
        .sidebar-nav a.active svg {
          color: var(--accent);
        }

        .sidebar-nav a.active:hover {
          background-color: transparent;
        }

        .sidebar-nav button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          color: var(--text-color);
          border-radius: 0.5rem;
          transition: background-color 0.2s ease, color 0.2s ease;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        
        .sidebar-nav button svg {
          flex-shrink: 0;
        }

        .sidebar-nav button:hover {
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
          animation: pulse 3s ease-in-out infinite;
        }

        .devtools-button svg {
          width: 24px;
          height: 24px;
          overflow: visible;
        }
        
        .devtools-button:hover {
          background-color: transparent;
          color: var(--accent);
          transform: scale(1.05);
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.9;
          }
        }
      `}</style>

      {/* Desktop title bar */}
      <div className="app-header">
        <h1 style={{
          color: "var(--accent)",
          fontSize: "1.5rem",
          fontWeight: "bold",
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          SolarEdge
        </h1>

        {/* Profile Button */}
        {user && (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                height: '38px',
                padding: '0 14px',
                borderRadius: '20px',
                background: showUserMenu ? 'var(--accent)' : 'rgba(255,122,0,0.1)',
                border: '1px solid rgba(255,122,0,0.3)',
                color: showUserMenu ? '#fff' : 'var(--text-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: showUserMenu ? '0 4px 12px rgba(255,122,0,0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!showUserMenu) {
                  e.currentTarget.style.background = 'rgba(255,122,0,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255,122,0,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showUserMenu) {
                  e.currentTarget.style.background = 'rgba(255,122,0,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,122,0,0.3)';
                }
              }}
            >
              <User size={18} />
              <span style={{
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.email?.split('@')[0] || 'User'}
              </span>
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '46px',
                right: '0',
                width: '280px',
                background: 'var(--navbar-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                zIndex: 1000,
                animation: 'slideDown 0.2s ease-out'
              }}>
                <div style={{
                  padding: '20px',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'rgba(255,122,0,0.05)'
                }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-color)',
                    marginBottom: '4px',
                    wordBreak: 'break-word'
                  }}>
                    {user.email}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--success-color)',
                      display: 'inline-block'
                    }}></span>
                    Real Dashboard Access
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--error-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--error-color)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--error-color)';
                  }}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/favicon.svg" alt="SolarEdge" width={30} height={30} />
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            title="Dashboard"
            className={({ isActive }) => (isActive || isDashboardRoute ? 'active' : undefined)}
          >
            <DashboardIcon />
          </NavLink>
          <NavLink to="/settings" title="Settings">
            <SettingsIcon />
          </NavLink>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            onClick={handleAdminAccess}
            title="Admin Access"
            aria-label="Admin access"
          >
            <LockIcon />
          </button>
        </nav>

        {devtoolsEnabled && <div className="devtools-divider" />}
        {devtoolsEnabled && (
          <button
            className="devtools-button"
            onClick={() => {
              if (onDevToolsToggle) onDevToolsToggle();
            }}
            title="Toggle Dev Tools"
            aria-label="Toggle Dev Tools"
          >
            <DevToolsIcon />
          </button>
        )}
      </div>

      {/* Technical Admin Portal Entrance */}
      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, rgba(0,10,30,0.95), rgba(10,25,50,0.95))",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(20px)",
            padding: "1rem",
            animation: "portalFadeIn 0.4s ease-out"
          }}
          onClick={() => setShowAdminPopup(false)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(5,10,25,0.98), rgba(15,30,60,0.98))",
              borderRadius: "28px",
              padding: "clamp(2rem, 5vw, 3.5rem)",
              color: "#fff",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 0 80px rgba(255, 122, 0, 0.15), 0 25px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,122,0,0.25)",
              animation: "adminPortalSlide 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
              maxHeight: "90vh",
              overflowY: "auto",
              backdropFilter: "blur(10px)",
              position: "relative",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tech Background Grid Pattern */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "radial-gradient(circle at 20% 50%, rgba(255,122,0,0.03), transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,212,170,0.02), transparent 50%)",
              pointerEvents: "none",
              zIndex: 0
            }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Header with Technical Icon */}
              <div style={{ textAlign: "center", marginBottom: "3rem" }}>
                <div style={{
                  width: "80px",
                  height: "80px",
                  margin: "0 auto 1.5rem",
                  background: "linear-gradient(135deg, rgba(255,122,0,0.15), rgba(0,212,170,0.08))",
                  border: "2px solid rgba(255,122,0,0.3)",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {/* Animated Border Glow */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(45deg, transparent, rgba(255,122,0,0.2), transparent)",
                    animation: "techGlow 3s ease-in-out infinite"
                  }} />
                  
                  {/* Gear/Cog Icon */}
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{
                    color: "var(--accent)",
                    position: "relative",
                    zIndex: 1
                  }}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.12-2.12l4.24-4.24M19.78 19.78l-4.24-4.24m-2.12-2.12l-4.24-4.24M19.78 4.22l-4.24 4.24m-2.12 2.12l-4.24 4.24" />
                  </svg>
                </div>

                <div>
                  <h2 style={{
                    margin: "0 0 0.75rem 0",
                    fontSize: "32px",
                    fontWeight: "800",
                    letterSpacing: "-0.5px",
                    background: "linear-gradient(135deg, var(--accent) 0%, #ff9d3d 50%, #00d4aa 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text"
                  }}>
                    SYSTEM ADMIN PORTAL
                  </h2>
                  <div style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    fontWeight: "600",
                    marginBottom: "0.5rem"
                  }}>
                    ▢ Advanced Control & Administration
                  </div>
                  <div style={{
                    height: "1px",
                    background: "linear-gradient(90deg, transparent, rgba(255,122,0,0.3), transparent)",
                    marginTop: "1rem"
                  }} />
                </div>
              </div>

              {/* Content */}
              {isAdmin ? (
                <>
                  {/* Status Banner */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(0,212,170,0.1), rgba(255,122,0,0.05))",
                    border: "1px solid rgba(0,212,170,0.2)",
                    borderRadius: "14px",
                    padding: "1.25rem",
                    marginBottom: "1.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem"
                  }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      background: "rgba(0,212,170,0.2)",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {/* User/People Icon */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "rgba(255,255,255,0.95)",
                        marginBottom: "0.25rem"
                      }}>
                        ADMIN VERIFIED
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.6)"
                      }}>
                        {user?.email?.split('@')[0]} • Full Access Granted
                      </div>
                    </div>
                  </div>

                  {/* Feature Cards */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                    marginBottom: "2rem"
                  }}>
                    <div style={{
                      padding: "1.25rem",
                      background: "linear-gradient(135deg, rgba(255,122,0,0.1), rgba(255,122,0,0.03))",
                      border: "1px solid rgba(255,122,0,0.2)",
                      borderRadius: "14px",
                      textAlign: "center",
                      transition: "all 0.3s ease",
                      cursor: "default",
                      position: "relative",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: "44px",
                        height: "44px",
                        margin: "0 auto 0.75rem",
                        background: "rgba(255,122,0,0.15)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        {/* User Management Icon */}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.7)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "600"
                      }}>
                        User Management
                      </div>
                    </div>

                    <div style={{
                      padding: "1.25rem",
                      background: "linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,212,170,0.03))",
                      border: "1px solid rgba(0,212,170,0.2)",
                      borderRadius: "14px",
                      textAlign: "center",
                      transition: "all 0.3s ease",
                      cursor: "default",
                      position: "relative",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: "44px",
                        height: "44px",
                        margin: "0 auto 0.75rem",
                        background: "rgba(0,212,170,0.15)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        {/* Settings/Control Icon */}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="1.5">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.7)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "600"
                      }}>
                        System Settings
                      </div>
                    </div>
                  </div>

                  {/* Primary Action */}
                  <button
                    onClick={() => {
                      setShowAdminPopup(false);
                      navigate('/admin/dashboard');
                    }}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, var(--accent), #ff9d3d)",
                      color: "#000",
                      border: "none",
                      padding: "14px 24px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700",
                      transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      boxShadow: "0 12px 32px rgba(255, 122, 0, 0.25)",
                      marginBottom: "0.75rem",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      position: "relative",
                      overflow: "hidden"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 16px 40px rgba(255, 122, 0, 0.35)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 12px 32px rgba(255, 122, 0, 0.25)";
                    }}
                  >
                    {/* Arrow Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    ENTER DASHBOARD
                  </button>

                  {/* Secondary Action */}
                  <button
                    onClick={() => setShowAdminPopup(false)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      color: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      transition: "all 0.2s ease",
                      letterSpacing: "0.5px"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                    }}
                  >
                    × CLOSE GATEWAY
                  </button>
                </>
              ) : (
                <>
                  {/* Restricted Access Section */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(220,53,69,0.12), rgba(220,53,69,0.05))",
                    border: "1.5px solid rgba(220,53,69,0.3)",
                    borderRadius: "14px",
                    padding: "2rem 1.5rem",
                    marginBottom: "2rem",
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden"
                  }}>
                    {/* Error glow background */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "radial-gradient(circle at center, rgba(220,53,69,0.1), transparent 70%)",
                      pointerEvents: "none"
                    }} />
                    
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{
                        width: "56px",
                        height: "56px",
                        margin: "0 auto 1.25rem",
                        background: "rgba(220,53,69,0.2)",
                        borderRadius: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        {/* Shield Lock Icon */}
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="1.5">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="M12 14v-4M10.5 14h3" />
                        </svg>
                      </div>
                      <h3 style={{
                        margin: "0 0 0.75rem 0",
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "rgba(220,53,69,0.95)",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase"
                      }}>
                        ACCESS DENIED
                      </h3>
                      <p style={{
                        margin: "0",
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.7)",
                        lineHeight: "1.7"
                      }}>
                        This portal requires administrator privileges. Your current account does not have the necessary permissions to access this system.
                      </p>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(255,122,0,0.08), rgba(0,212,170,0.04))",
                    border: "1px solid rgba(255,122,0,0.15)",
                    borderRadius: "14px",
                    padding: "1.5rem",
                    marginBottom: "1.5rem",
                    textAlign: "center"
                  }}>
                    <div style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: "1.8",
                      marginBottom: "0.75rem"
                    }}>
                      Need admin access? Contact your system administrator
                    </div>
                    <div style={{
                      display: "inline-block",
                      padding: "0.5rem 1rem",
                      background: "rgba(255,122,0,0.1)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "var(--accent)",
                      fontWeight: "700",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase"
                    }}>
                      REQUEST ELEVATED PERMISSIONS
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => setShowAdminPopup(false)}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      transition: "all 0.2s ease",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                    }}
                  >
                    × CLOSE
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes adminPortalSlide {
          0% {
            transform: scale(0.85) translateY(40px);
            opacity: 0;
          }
          50% {
            transform: scale(1.02) translateY(-5px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes portalFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
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
          100% {
            transform: translateX(100%);
            opacity: 0;
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
