import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ThemeContext } from "./ThemeContext";
import { AuthContext } from "../contexts/AuthContext";
import { ComputerIcon, LogOut, User } from "lucide-react";

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

function Sidebar({ onDevToolsToggle }) {
  const devtoolsEnabled = (import.meta?.env?.VITE_ENABLE_DEVTOOLS ?? 'true') === 'true';
  const { theme, setTheme } = useContext(ThemeContext);
  const { session, signOut, user } = useContext(AuthContext);
  const navigate = useNavigate();

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
        
        .sidebar-nav a:hover,
        .sidebar-nav a.active {
          background-color: var(--accent);
          color: white;
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
          background-color: var(--accent);
          color: white;
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
          background: linear-gradient(135deg, var(--accent), var(--accent-dark, #0070f3));
          color: white;
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0,122,255,0.3);
          font-size: 1.25rem;
          animation: pulse 3s ease-in-out infinite;
        }
        
        .devtools-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0,122,255,0.5);
          border-color: rgba(255,255,255,0.3);
        }
        
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 4px 12px rgba(0,122,255,0.3);
          }
          50% {
            box-shadow: 0 4px 20px rgba(0,122,255,0.6);
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
          <NavLink to="/" end title="Dashboard">
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

          {session && (
            <button
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              style={{
                marginTop: 'auto'
              }}
            >
              <LogOut />
            </button>
          )}
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
            <ComputerIcon />
          </button>
        )}
      </div>

      {/* Admin Access Popup */}
      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(10px)",
            padding: "1rem"
          }}
          onClick={() => setShowAdminPopup(false)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
              borderRadius: "20px",
              padding: "clamp(1.5rem, 4vw, 2.5rem)",
              color: "#fff",
              textAlign: "center",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              border: "2px solid var(--accent)",
              animation: "popupBounce 0.5s ease-out",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚫</div>
            <h2 style={{
              marginBottom: "1rem",
              color: "var(--accent)",
              fontSize: "1.8rem",
              textShadow: "0 2px 4px rgba(0,0,0,0.5)"
            }}>
              🛡️ RESTRICTED ACCESS! 🛡️
            </h2>
            <p style={{
              marginBottom: "1.5rem",
              fontSize: "1.1rem",
              lineHeight: "1.6",
              color: "#e0e0e0"
            }}>
              🎭 <strong>Nice try, sneaky one!</strong> 🎭<br />
              This area is for <span style={{ color: "var(--accent)", fontWeight: "bold" }}>ADMIN WIZARDS</span> only!<br />
              <br />
              🔮 You need special admin powers to enter this mystical realm!<br />
              💫 Contact your system administrator for the secret handshake!<br />
              <br />
              <em style={{ color: "#888" }}>Or maybe you're just curious... we like that! 😉</em>
            </p>

            <div style={{
              marginBottom: "1.5rem",
              textAlign: "center"
            }}>
              <p style={{
                fontSize: "0.8rem",
                color: "#666",
                margin: "0 0 0.3rem 0",
                fontStyle: "italic",
                opacity: 0.7
              }}>
                <em>Maybe try clicking on the lightbulb emoji above? 💡</em>
              </p>
              <span
                onClick={() => {
                  setShowAdminPopup(false);
                  window.location.href = '/admin/dashboard';
                }}
                style={{
                  color: "#666",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  textDecoration: "underline",
                  opacity: 0.5,
                  transition: "opacity 0.3s ease",
                  display: "inline-block"
                }}
                onMouseOver={(e) => {
                  e.target.style.opacity = "0.8";
                }}
                onMouseOut={(e) => {
                  e.target.style.opacity = "0.5";
                }}
              >
                <em>BoooooooooooooooHaa!...</em>
              </span>
            </div>
            <button
              onClick={() => setShowAdminPopup(false)}
              style={{
                background: "linear-gradient(45deg, var(--accent), #00d4aa)",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "25px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(0, 212, 170, 0.3)",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "scale(1.05)";
                e.target.style.boxShadow = "0 6px 20px rgba(0, 212, 170, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = "0 4px 15px rgba(0, 212, 170, 0.3)";
              }}
            >
              🎪 Got it, thanks!
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes popupBounce {
          0% {
            transform: scale(0.3) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.05) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
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
