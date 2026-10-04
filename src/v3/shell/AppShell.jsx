import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/context.js';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { titleFor } from './nav.js';
import { SvgDefs } from '../ui/SvgDefs.jsx';
import { blockCopy } from './copy.js';

/** Page frame: glow background, sidebar / bottom tab bar, header, and the routed page. */
export function AppShell() {
  const { theme, scheme } = useTheme();
  const { pathname } = useLocation();
  const rootRef = useRef(null);
  // A new page starts at the top, not wherever the last one was scrolled to.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // The browser tab and screen readers announce the page, not just the product.
  useEffect(() => { document.title = `${titleFor(pathname)} · SolarEdge`; }, [pathname]);
  // The page behind the app (overscroll, the strip under the phone tab bar) takes the theme's background too.
  useEffect(() => {
    const bg = rootRef.current ? getComputedStyle(rootRef.current).getPropertyValue('--bg').trim() : '';
    if (bg) document.documentElement.style.background = bg;
  }, [theme]);
  useEffect(() => {
    document.addEventListener('copy', blockCopy);
    return () => document.removeEventListener('copy', blockCopy);
  }, []);
  return (
    <div className="v3-root" data-theme={theme} data-scheme={scheme} ref={rootRef}>
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
