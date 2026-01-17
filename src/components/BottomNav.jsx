import React, { useState, useContext, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeContext } from "./ThemeContext";
import { AuthContext } from "../contexts/AuthContext";
import {
    LayoutDashboard,
    Settings,
    User,
    Moon,
    Sun,
    ShieldAlert,
    LogOut,
    Menu,
    X
} from "lucide-react";

export default function BottomNav() {
    const { theme, setTheme } = useContext(ThemeContext);
    const { user, signOut } = useContext(AuthContext);
    const [showMenu, setShowMenu] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path) => location.pathname === path;

    // Prevent background scrolling when menu is open
    useEffect(() => {
        if (showMenu) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showMenu]);

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = async () => {
        await signOut();
        setShowMenu(false);
        navigate('/');
    };

    return (
        <>
            <style>{`
        /* Mobile Bottom Nav Styles */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 65px;
          background: var(--navbar-bg); 
          border-top: 1px solid var(--border-color);
          display: none; /* Hidden by default, shown via media query */
          justify-content: space-around;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
          box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
          backdrop-filter: blur(10px);
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          height: 100%;
          color: var(--text-secondary);
          text-decoration: none;
          gap: 4px;
          transition: all 0.2s ease;
          background: none;
          border: none;
          cursor: pointer;
        }

        .nav-item.active {
          color: var(--accent);
        }

        .nav-item svg {
          width: 24px;
          height: 24px;
          stroke-width: 2px;
        }

        .nav-label {
          font-size: 10px;
          font-weight: 500;
        }

        /* Mobile Menu Drawer */
        .mobile-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          z-index: 1001;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          backdrop-filter: blur(4px);
        }

        .mobile-menu-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .mobile-drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--sidebar-bg);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 24px;
          z-index: 1002;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border-top: 1px solid var(--border-color);
          padding-bottom: calc(24px + env(safe-area-inset-bottom));
        }

        .mobile-drawer.open {
          transform: translateY(0);
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .drawer-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .drawer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: bold;
        }

        .drawer-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 16px;
          background: var(--hover-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          margin-bottom: 12px;
          color: var(--text-color);
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.1s ease;
        }

        .drawer-item:active {
          transform: scale(0.98);
        }

        .drawer-item svg {
          margin-right: 16px;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex;
          }
        }
      `}</style>

            {/* Bottom Navigation Bar */}
            <div className="bottom-nav">
                <Link to="/" className={`nav-item ${isActive('/') || isActive('/dashboard') ? 'active' : ''}`}>
                    <LayoutDashboard />
                    <span className="nav-label">Dashboard</span>
                </Link>

                <Link to="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`}>
                    <Settings />
                    <span className="nav-label">Settings</span>
                </Link>

                {/* Profile / Menu Trigger */}
                <button className={`nav-item ${showMenu ? 'active' : ''}`} onClick={() => setShowMenu(true)}>
                    <Menu />
                    <span className="nav-label">Menu</span>
                </button>
            </div>

            {/* Slide-up Drawer */}
            <div className={`mobile-menu-overlay ${showMenu ? 'open' : ''}`} onClick={() => setShowMenu(false)} />

            <div className={`mobile-drawer ${showMenu ? 'open' : ''}`}>
                <div className="drawer-header">
                    <div className="drawer-user-info">
                        <div className="drawer-avatar">
                            <User size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{user?.email?.split('@')[0] || 'Guest'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.email || 'Not logged in'}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowMenu(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-color)' }}
                    >
                        <X />
                    </button>
                </div>

                <button className="drawer-item" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                </button>

                <button className="drawer-item" onClick={() => { setShowMenu(false); navigate('/admin/dashboard'); }}>
                    <ShieldAlert size={20} color="var(--accent)" />
                    <span>Admin Dashboard</span>
                </button>

                {user && (
                    <button
                        className="drawer-item"
                        onClick={handleLogout}
                        style={{ color: 'var(--error-color)', borderColor: 'rgba(255, 68, 68, 0.3)' }}
                    >
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </button>
                )}
            </div>
        </>
    );
}
