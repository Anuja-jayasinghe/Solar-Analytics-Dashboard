import { Navigate, useLocation } from 'react-router-dom';
import { useAccess } from './context.js';
import { canSee } from './level.js';
import { Note } from '../ui/Note.jsx';

/**
 * Route guard. Hides a screen from people who cannot use it. It is NOT the security control: the API
 * refuses the data regardless (api/_lib/verifyAdminToken.js).
 *  - still resolving: a quiet placeholder (never a flash of the wrong screen)
 *  - signed out: to the sign-in doorway, remembering where they were headed
 *  - signed in but not allowed: a plain explanation
 */
export function RequireAccess({ level, children }) {
  const { level: mine } = useAccess();
  const location = useLocation();
  if (mine === 'loading') return <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Checking access" />;
  if (canSee(mine, level)) return children;
  if (mine === 'none') return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return <Note tone="bad">Your account does not have access to this page.</Note>;
}
