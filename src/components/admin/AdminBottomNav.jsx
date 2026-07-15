import React from "react";
import { NavLink } from "react-router-dom";
import { Users, FileText } from "lucide-react";

export default function AdminBottomNav() {
  return (
    <>
      <style>{`
        .admin-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 65px;
          background: var(--navbar-bg, var(--card-bg-solid));
          border-top: 1px solid var(--border-color);
          display: none;
          justify-content: space-around;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
          box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
          backdrop-filter: blur(10px);
        }

        .admin-bottom-nav .nav-item {
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
        }

        .admin-bottom-nav .nav-item.active {
          color: var(--accent);
        }

        .admin-bottom-nav .nav-item svg {
          width: 22px;
          height: 22px;
          stroke-width: 2px;
        }

        .admin-bottom-nav .nav-label {
          font-size: 10px;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .admin-bottom-nav {
            display: flex;
          }
        }
      `}</style>

      <div className="admin-bottom-nav">
        <NavLink to="/admin/dashboard/users" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <Users />
          <span className="nav-label">Users</span>
        </NavLink>

        <NavLink to="/admin/dashboard/ceb-billing" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
          <FileText />
          <span className="nav-label">CEB Billing</span>
        </NavLink>
      </div>
    </>
  );
}
