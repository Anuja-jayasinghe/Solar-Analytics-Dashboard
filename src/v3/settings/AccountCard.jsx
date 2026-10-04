import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { roleLabel } from '../access/level.js';

/** Who you are, what you can see, and how to sign in or out. The roles match the sign-in doorway. */
export function AccountCard({ level, email, onSignIn, onSignOut }) {
  const role = roleLabel(level);
  const signedIn = level === 'viewer' || level === 'admin';
  return (
    <Glass card aria-label="Account">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Account</h2>
          <div className="v3-sub">{signedIn ? (email ?? 'Signed in') : 'Not signed in'}</div>
        </div>
        <Pill tone={level === 'admin' ? 'gen' : level === 'viewer' ? 'ceb' : undefined}>{role.label}</Pill>
      </div>
      <div className="v3-mut" style={{ fontSize: 13, lineHeight: 1.5 }}>{role.sub}.</div>
      <div>
        {signedIn
          ? onSignOut && <button type="button" className="v3-btn" onClick={onSignOut}>Sign out</button>
          : onSignIn && <button type="button" className="v3-btn primary" onClick={onSignIn}>Sign in</button>}
      </div>
    </Glass>
  );
}
