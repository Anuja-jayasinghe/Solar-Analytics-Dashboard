import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

// --- SVG Icons ---

const DashboardIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const SettingsIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const CollapseIcon = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="m14 9-3-3 3-3" />
    </svg>
);


function Sidebar({ isCollapsed, setIsCollapsed }) {
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <>
      <style>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          background-color: var(--sidebar-bg);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          position: fixed;
          top: 0;
          left: 0;
          border-right: 1px solid var(--border-color);
          z-index: 1000;
        }
        .sidebar.collapsed {
          width: 80px;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          margin-bottom: 2rem;
          color: var(--text-color);
          text-decoration: none;
        }
        .sidebar-logo .logo-icon {
          font-size: 2rem;
          line-height: 1;
        }
        .sidebar-logo .logo-text {
          font-size: 1.5rem;
          font-weight: bold;
          margin-left: 0.5rem;
          white-space: nowrap;
          opacity: 1;
          transition: opacity 0.3s ease, margin-left 0.3s ease;
        }
        .sidebar.collapsed .logo-text {
          opacity: 0;
          margin-left: -20px;
          pointer-events: none;
        }
        .sidebar-nav ul {
          list-style: none;
          padding: 0;
          margin: 0;
          flex-grow: 1;
        }
        .sidebar-nav li {
          margin-bottom: 0.5rem;
        }
        .sidebar-nav a {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          color: var(--text-color);
          text-decoration: none;
          transition: background-color 0.2s ease, color 0.2s ease;
          white-space: nowrap;
        }
        .sidebar-nav a:hover {
          background-color: var(--hover-bg);
        }
        .sidebar-nav a.active {
          background-color: var(--accent);
          color: white;
          font-weight: 500;
        }
        .sidebar-nav .nav-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }
        .sidebar-nav .nav-text {
          margin-left: 1rem;
          opacity: 1;
          transition: opacity 0.3s ease, margin-left 0.3s ease;
        }
        .sidebar.collapsed .nav-text {
          opacity: 0;
          margin-left: -20px;
          pointer-events: none;
        }
        .sidebar-toggle {
            margin-top: auto;
            border: none;
            background: none;
            cursor: pointer;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            color: var(--text-color);
            transition: background-color 0.2s ease;
        }
        .sidebar-toggle:hover {
            background-color: var(--hover-bg);
        }
        .sidebar-toggle .toggle-icon {
            width: 24px;
            height: 24px;
            transition: transform 0.3s ease;
        }
        .sidebar.collapsed .toggle-icon {
            transform: rotate(180deg);
        }
        .sidebar-toggle .toggle-text {
            margin-left: 1rem;
            opacity: 1;
            transition: opacity 0.3s ease;
            white-space: nowrap;
        }
        .sidebar.collapsed .toggle-text {
            opacity: 0;
            pointer-events: none;
        }
      `}</style>
      <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <Link to="/" className="sidebar-logo">
          <span className="logo-icon">⚡</span>
          <h2 className="logo-text">SolarEdge</h2>
        </Link>
        <nav className="sidebar-nav">
          <ul>
            <li>
              <NavLink to="/" end>
                <DashboardIcon className="nav-icon" />
                <span className="nav-text">Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings">
                <SettingsIcon className="nav-icon" />
                <span className="nav-text">Settings</span>
              </NavLink>
            </li>
          </ul>
        </nav>
        <button className="sidebar-toggle" onClick={toggleSidebar}>
            <CollapseIcon className="toggle-icon" />
            <span className="toggle-text">Collapse</span>
        </button>
      </div>
    </>
  );
}


// A Layout component to wrap your main application content
export function AppLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <>
        <style>{`
            .main-content {
                transition: margin-left 0.3s ease;
                margin-left: 260px; /* Default sidebar width */
                padding: 2rem;
            }
            .main-content.collapsed {
                margin-left: 80px; /* Collapsed sidebar width */
            }
        `}</style>
        <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
        <main className={`main-content ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            {children}
        </main>
    </>
  );
}

export default Sidebar;
