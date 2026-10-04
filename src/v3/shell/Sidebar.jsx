import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAccess } from '../access/context.js';
import { roleLabel } from '../access/level.js';
import { navGroup } from './nav.js';
import { readPref, writePref } from '../theme/storage.js';
import { Icon } from './icons.jsx';
import { Tip } from '../ui/Tip.jsx';

function Item({ item, collapsed }) {
  const link = (
    <NavLink to={item.path} end={item.end} className="v3-navitem" aria-label={item.label}>
      <Icon id={item.icon} />
      <span className="v3-label">{item.label}</span>
    </NavLink>
  );
  // Collapsed to icons: the label moves into a hint so the control is still named on hover, focus and tap.
  return collapsed ? <Tip text={item.label} side="right">{link}</Tip> : link;
}

/** Desktop: a full-height sidebar that collapses to icons. Phone (CSS): the same markup becomes a bottom tab bar. */
export function Sidebar() {
  const { level } = useAccess();
  const [collapsed, setCollapsed] = useState(() => readPref('rail', 'open') === 'collapsed');
  const toggle = () => {
    setCollapsed((c) => {
      writePref('rail', c ? 'open' : 'collapsed');
      return !c;
    });
  };
  const who = roleLabel(level);

  return (
    <nav className="v3-glass v3-rail" data-collapsed={collapsed} aria-label="Main">
      <div className="v3-rail-in">
        <div className="v3-rail-group">
          <Link to="/" className="v3-brand v3-hide-phone" aria-label="Solar Analytics, Overview">
            <span className="v3-brand-mark" aria-hidden="true">S</span>
            {!collapsed && <span className="v3-brand-name">Solar Analytics</span>}
          </Link>
          {navGroup(level, 'main').map((n) => <Item key={n.id} item={n} collapsed={collapsed} />)}
        </div>
        <div className="v3-rail-group">
          {navGroup(level, 'foot').map((n) => <Item key={n.id} item={n} collapsed={collapsed} />)}
          <Link to={level === 'none' ? '/signin' : '/settings'} className="v3-navitem v3-account" aria-label={`${who.label}. ${who.sub}`}>
            <span className="v3-avatar" aria-hidden="true">{who.label[0]}</span>
            <span className="v3-account-text v3-label v3-hide-phone"><b>{who.label}</b><span>{who.sub}</span></span>
          </Link>
          <button type="button" className="v3-navitem v3-collapse v3-hide-phone" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            <Icon id="collapse" />
            <span className="v3-label">Collapse</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
