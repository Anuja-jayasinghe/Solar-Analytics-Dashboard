import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { AccessProvider } from './access/AccessProvider.jsx';
import { RequireAccess } from './access/RequireAccess.jsx';
import { DataProvider } from './data/DataProvider.jsx';
import { AppShell } from './shell/AppShell.jsx';
import ComingSoon from './pages/ComingSoon.jsx';

const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'));

const Loading = () => <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />;

/**
 * The v3 app. It lives at /v3 while v1 keeps serving /dashboard; at cutover this becomes the app root.
 * Plan: docs/V3_REFACTOR_PLAN.md (P5b). Design: docs/design/v3/README.md.
 */
export default function V3Root() {
  return (
    <ThemeProvider>
      <AccessProvider>
        <DataProvider>
          <BrowserRouter basename="/v3">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="pro" element={<ComingSoon slice="pro">Health, uptime by day, alarms, electrical health and what each bill really paid.</ComingSoon>} />
                  <Route path="admin/*" element={<RequireAccess level="admin"><ComingSoon slice="admin">Bills, access and data health.</ComingSoon></RequireAccess>} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="signin" element={<SignInPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DataProvider>
      </AccessProvider>
    </ThemeProvider>
  );
}
