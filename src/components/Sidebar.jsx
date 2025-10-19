import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";

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

function Sidebar() {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
        
        .sidebar-logo {
          font-size: 2rem;
          color: var(--text-color);
          margin-bottom: 2rem;
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
            width: 100%;
            height: auto;
            position: relative;
            flex-direction: row;
            padding: 0.5rem;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
          }
          
          .sidebar.closed {
            transform: translateY(-100%);
          }
          
          .sidebar-nav {
            flex-direction: row;
            margin-top: 0;
            gap: 0.5rem;
          }
          
          .sidebar-logo {
            margin-bottom: 0;
            margin-right: 1rem;
          }
        }
      `}</style>
      
      {isMobile && (
        <button 
          className={`hamburger ${isOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 1001,
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem',
          }}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      )}
      
      <div className={`sidebar ${isMobile ? 'mobile' : ''} ${isMobile && !isOpen ? 'closed' : ''}`}>
        <div className="sidebar-logo">
          <img src="/favicon.svg" alt="SolarEdge" width={30} height={30} />
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={closeSidebar}>
            <DashboardIcon />
          </NavLink>
          <NavLink to="/settings" onClick={closeSidebar}>
            <SettingsIcon />
          </NavLink>
        </nav>
      </div>
    </>
  );
}

// --- Layout wrapper ---
export function AppLayout({ children }) {
  return (
    <>
      <Sidebar />
      <main style={{ marginLeft: "80px", padding: "2rem" }}>
        {children}
      </main>
    </>
  );
}

export default Sidebar;
