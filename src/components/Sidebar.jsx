import { Link, NavLink } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { ThemeContext } from "./ThemeContext";
import { ShieldEllipsis } from "lucide-react";
import { ShieldEllipsisIcon } from "lucide-react";
import { ComputerIcon } from "lucide-react";
import { FileWarning } from "lucide-react";
import { LucideMessageSquareWarning } from "lucide-react";
import { MailWarning } from "lucide-react";

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
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showAdminPopup, setShowAdminPopup] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const handleAdminAccess = () => {
    setShowAdminPopup(true);
    closeSidebar();
  };

  return (
    <>
      {/* Desktop title bar */}
      {!isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 60,
          right: 0,
          height: '60px',
          background: 'var(--bg-color)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft:'1rem',
          paddingTop:'0.5rem',
          zIndex: 100
        }}>
          <h1 style={{ 
            color: "var(--accent)", 
            fontSize: "2rem", 
            fontWeight: "bold",
            margin: 0
          }}>
            SolarEdge
          </h1>
        </div>
      )}

      {/* Mobile hamburger and title */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'var(--navbar-bg)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '0.75rem',
          zIndex: 999,
          transition: 'opacity 0.3s ease',
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'auto'
        }}>
          <button 
            className="hamburger"
            onClick={toggleSidebar}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '44px',
              minHeight: '44px',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <span style={{
              width: '4px',
              height: '3px',
              background: 'var(--accent)',
              borderRadius: '2px',
              transition: 'all 0.3s ease'
            }}></span>
            <span style={{
              width: '24px',
              height: '3px',
              background: 'var(--accent)',
              borderRadius: '2px',
              transition: 'all 0.3s ease'
            }}></span>
            <span style={{
              width: '24px',
              height: '3px',
              background: 'var(--accent)',
              borderRadius: '2px',
              transition: 'all 0.3s ease'
            }}></span>
          </button>
          <h1 style={{ 
            color: "var(--accent)", 
            fontSize: "1.5rem", 
            fontWeight: "bold",
            margin: 0
          }}>
            SolarEdge
          </h1>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}
          onClick={closeSidebar}
        />
      )}

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
        
        .sidebar.mobile {
          width: 100%;
          height: auto;
          position: relative;
          flex-direction: row;
          padding: 0.5rem;
          border-right: none;
          border-bottom: 1px solid var(--border-color);
          transform: translateY(0);
        }
        
        .sidebar.mobile.closed {
          transform: translateY(-100%);
        }
        
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 2rem;
        }
        
        .sidebar.mobile .sidebar-nav {
          flex-direction: row;
          margin-top: 0;
          gap: 0.5rem;
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
        
        .sidebar.mobile .devtools-divider {
          display: none;
        }
        
        .sidebar.mobile .devtools-button {
          margin-left: auto;
        }
        
        .sidebar.mobile .sidebar-logo {
          margin-bottom: 0;
          margin-right: 1rem;
        }
        
        .hamburger {
          display: none;
          flex-direction: column;
          cursor: pointer;
          padding: 0.5rem;
          background: none;
          border: none;
          color: var(--text-color);
          z-index: 1002;
        }
        
        .hamburger span {
          width: 25px;
          height: 3px;
          background-color: var(--text-color);
          margin: 3px 0;
          transition: 0.3s;
          border-radius: 2px;
        }
        
        .hamburger.active span:nth-child(1) {
          transform: rotate(-45deg) translate(-5px, 6px);
        }
        
        .hamburger.active span:nth-child(2) {
          opacity: 0;
        }
        
        .hamburger.active span:nth-child(3) {
          transform: rotate(45deg) translate(-5px, -6px);
        }
        
        @media (max-width: 768px) {
          .hamburger {
            display: flex;
          }
          
          .sidebar {
            width: 280px;
            height: 100vh;
            position: fixed;
            flex-direction: column;
            padding: 1rem 0;
            border-right: 1px solid var(--border-color);
            border-bottom: none;
            left: 0;
            top: 0;
            transition: transform 0.3s ease;
            overflow-y: auto;
            z-index: 1001;
          }
          
          .sidebar.closed {
            transform: translateX(-100%);
          }
          
          .sidebar-nav {
            flex-direction: column;
            margin-top: 2rem;
            gap: 1rem;
          }
          
          .sidebar-logo {
            margin-bottom: 2rem;
            margin-right: 0;
          }

          .sidebar-nav a,
          .sidebar-nav button {
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
      
      <div className={`sidebar ${isMobile ? 'mobile' : ''} ${isMobile && !isOpen ? 'closed' : ''}`}>
        {!isMobile && (
          <div className="sidebar-logo">
            <img src="/favicon.svg" alt="SolarEdge" width={30} height={30} />
          </div>
        )}
        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={closeSidebar} title="Dashboard">
            <DashboardIcon />
          </NavLink>
          <NavLink to="/settings" onClick={closeSidebar} title="Settings">
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
            <LockIcon/>
          </button>
        </nav>
        
        {!isMobile && devtoolsEnabled && <div className="devtools-divider" />}
        {devtoolsEnabled && (
          <button
            className="devtools-button"
            onClick={() => {
              if (onDevToolsToggle) onDevToolsToggle();
              if (isMobile) closeSidebar();
            }}
            title="Toggle Dev Tools"
            aria-label="Toggle Dev Tools"
          >
            <ComputerIcon/>
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
              🎭 <strong>Nice try, sneaky one!</strong> 🎭<br/>
              This area is for <span style={{ color: "var(--accent)", fontWeight: "bold" }}>ADMIN WIZARDS</span> only!<br/>
              <br/>
              🔮 You need special admin powers to enter this mystical realm!<br/>
              💫 Contact your system administrator for the secret handshake!<br/>
              <br/>
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
                  window.location.href = '/admin';
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
