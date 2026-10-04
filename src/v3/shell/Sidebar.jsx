import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAccess } from '../access/context.js';
import { usePrefs } from '../prefs/context.js';
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
  // Collapsed to icons: the label stays reachable as a hint (always shown, even when figure hints are off).
  return collapsed ? <Tip always text={item.label} side="right">{link}</Tip> : link;
}

/**
 * Desktop: a full-height sidebar, collapsed to icons by default. Phone (CSS): a bottom tab bar.
 * The account lives in the top-right corner (AccountMenu); the sidebar only navigates and holds two switches.
 */
export function Sidebar() {
  const { level } = useAccess();
  const { hints, setHints } = usePrefs();
  const [collapsed, setCollapsed] = useState(() => readPref('rail', 'collapsed') === 'collapsed');
  const toggle = () => {
    setCollapsed((c) => {
      writePref('rail', c ? 'open' : 'collapsed');
      return !c;
    });
  };
  const hintsLabel = hints ? 'Hints on' : 'Hints off';
  const hintsButton = (
    <button type="button" className="v3-navitem v3-hide-phone" aria-pressed={hints} aria-label={hints ? 'Turn hints off' : 'Turn hints on'} onClick={() => setHints(!hints)}>
      <Icon id={hints ? 'hintsOn' : 'hintsOff'} />
      <span className="v3-label">{hintsLabel}</span>
    </button>
  );

  return (
    <nav className="v3-glass v3-rail" data-collapsed={collapsed} aria-label="Main">
      <div className="v3-rail-in">
        <div className="v3-rail-group">
          <Link to="/" className="v3-brand v3-hide-phone" aria-label="SolarEdge, Overview">
            <img className="v3-brand-mark" src="/favicon.svg" alt="" width="28" height="28" />
            {!collapsed && <span className="v3-brand-name">SolarEdge</span>}
          </Link>
          {navGroup(level, 'main').map((n) => <Item key={n.id} item={n} collapsed={collapsed} />)}
        </div>
        <div className="v3-rail-group">
          {navGroup(level, 'foot').map((n) => <Item key={n.id} item={n} collapsed={collapsed} />)}
          {collapsed ? <Tip always text={hints ? 'Hints on: click to turn off' : 'Hints off: click to turn on'} side="right">{hintsButton}</Tip> : hintsButton}
          <button type="button" className="v3-navitem v3-collapse v3-hide-phone" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            <Icon id="collapse" />
            <span className="v3-label">Collapse</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
