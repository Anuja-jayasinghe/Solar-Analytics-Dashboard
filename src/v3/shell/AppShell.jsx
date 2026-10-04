import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/context.js';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { titleFor } from './nav.js';
import { SvgDefs } from '../ui/SvgDefs.jsx';

/** Page frame: glow background, sidebar / bottom tab bar, header, and the routed page. */
export function AppShell() {
  const { theme, scheme } = useTheme();
  const { pathname } = useLocation();
  // A new page starts at the top, not wherever the last one was scrolled to.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // The browser tab and screen readers announce the page, not just the product.
  useEffect(() => { document.title = `${titleFor(pathname)} · Solar Analytics`; }, [pathname]);
  return (
    <div className="v3-root" data-theme={theme} data-scheme={scheme}>
      <a className="v3-skip" href="#main">Skip to content</a>
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
