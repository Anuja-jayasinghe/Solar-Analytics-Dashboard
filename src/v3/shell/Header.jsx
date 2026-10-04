import { useLocation } from 'react-router-dom';
import { useTheme } from '../theme/context.js';
import { useDataSource } from '../data/context.js';
import { titleFor } from './nav.js';
import { Icon } from './icons.jsx';

const today = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date());

export function Header() {
  const { pathname } = useLocation();
  const { theme, themes, cycle } = useTheme();
  const { mode } = useDataSource();
  const next = themes[(themes.findIndex((t) => t.id === theme) + 1) % themes.length];

  return (
    <header className="v3-header">
      <h1 className="v3-title">{titleFor(pathname)}</h1>
      <div className="v3-header-right">
        <span>
          {mode === 'demo' ? <><span className="v3-badge">DEMO DATA</span> · dated 2035 onwards</> : today()}
        </span>
        <button type="button" className="v3-iconbtn" onClick={cycle} aria-label={`Switch to ${next.name}`}>
          <Icon id={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
      </div>
    </header>
  );
}
