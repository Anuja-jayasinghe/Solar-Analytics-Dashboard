import { Outlet } from 'react-router-dom';
import { useTheme } from '../theme/context.js';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { SvgDefs } from '../ui/SvgDefs.jsx';

/** Page frame: glow background, sidebar / bottom tab bar, header, and the routed page. */
export function AppShell() {
  const { theme, scheme } = useTheme();
  return (
    <div className="v3-root" data-theme={theme} data-scheme={scheme}>
      <SvgDefs />
      <div className="v3-glows" aria-hidden="true"><i /><i /><i /></div>
      <div className="v3-layout">
        <Sidebar />
        <main className="v3-main" id="main">
          <Header />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
