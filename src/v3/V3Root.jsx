import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { AccessProvider } from './access/AccessProvider.jsx';
import { RequireAccess } from './access/RequireAccess.jsx';
import { DataProvider } from './data/DataProvider.jsx';
import { AppShell } from './shell/AppShell.jsx';
import { AppErrorBoundary } from './ui/AppErrorBoundary.jsx';
// The Overview is what nearly everyone opens first: bundled with the app so the first paint does not wait
// for one more round trip. Every other page is loaded when it is visited.
import OverviewPage from './pages/OverviewPage.jsx';
import { legacyRedirect } from './routes.js';

const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const ProPage = lazy(() => import('./pages/ProPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const Loading = () => <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />;

/** Old addresses (bookmarks, the /v3 preview prefix) go to their new home; anything else is a real 404. */
function Fallback() {
  const { pathname, search } = useLocation();
  const to = legacyRedirect(pathname);
  if (to) return <Navigate to={`${to}${search}`} replace />;
  return <NotFoundPage />;
}

/**
 * The app. Served at "/"; the previous dashboard is deprecated and lives under /v1.
 * Plan: docs/V3_REFACTOR_PLAN.md. Design: docs/design/v3/README.md.
 */
export default function V3Root() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AccessProvider>
          <DataProvider>
            <BrowserRouter>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<OverviewPage />} />
                    <Route path="pro" element={<ProPage />} />
                    <Route path="admin/*" element={<RequireAccess level="admin"><AdminPage /></RequireAccess>} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="signin" element={<SignInPage />} />
                    <Route path="*" element={<Fallback />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </DataProvider>
        </AccessProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
