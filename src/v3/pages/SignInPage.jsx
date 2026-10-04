import { Link, Navigate, useLocation } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useAccess } from '../access/context.js';
import { useTheme } from '../theme/context.js';
import { clerkColorsOf } from '../theme/themes.js';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';

export const CONTACT_URL = 'https://anujajay.com/#contact';

const ROLES = [
  { tone: undefined, name: 'Visitor', text: 'Sees every page on demo data dated 2035 onwards. Nothing real is exposed or even sent to the browser.' },
  { tone: 'ceb', name: 'Viewer', text: 'Invited by the owner. Real data, read only, including Pro metrics.' },
  { tone: 'gen', name: 'Admin', text: 'Everything a viewer sees, plus bill upload and approval, access, plant settings and data health.' }
];

/** Clerk's own form, drawn inside our card in the current theme (no pop-up, no second sign-in step). */
function ClerkForm({ mode }) {
  const { theme } = useTheme();
  const appearance = {
    variables: { ...clerkColorsOf(theme), borderRadius: '12px', fontFamily: 'Manrope, system-ui, sans-serif' },
    elements: {
      rootBox: { width: '100%' },
      cardBox: { width: '100%', maxWidth: '100%', boxShadow: 'none', border: '0' },
      card: { boxShadow: 'none', background: 'transparent', padding: '4px 0' },
      footer: { background: 'transparent' }
    }
  };
  return mode === 'signup'
    ? <SignUp routing="virtual" signInUrl="/signin" forceRedirectUrl="/" appearance={appearance} />
    : <SignIn routing="virtual" signUpUrl="/signup" forceRedirectUrl="/" appearance={appearance} />;
}

/** The doorway: Clerk's sign-in (or sign-up) embedded, a way back to the demo, and how to ask for access. */
export default function SignInPage({ mode = 'signin' }) {
  const { level, clerk } = useAccess();
  const location = useLocation();
  if (level === 'viewer' || level === 'admin') return <Navigate to={location.state?.from || '/'} replace />;
  const signup = mode === 'signup';
  return (
    <section className="v3-door">
      <Glass className="v3-door-card">
        <div style={{ textAlign: 'center' }}>
          <h2 className="v3-h2" style={{ fontSize: 22 }}>{signup ? 'Create an account' : 'Sign in for the live plant'}</h2>
          <div className="v3-sub">
            {signup
              ? 'After signing up you will see the demo until the owner gives your account access.'
              : 'Invite only. Without signing in you can still explore everything on demo data.'}
          </div>
        </div>
        {clerk && level !== 'loading' && <ClerkForm mode={mode} />}
        {clerk && level === 'loading' && <div className="v3-skeleton" style={{ height: 260 }} aria-busy="true" aria-label="Loading sign-in" />}
        {!clerk && <div className="v3-note">Sign-in is not available on this copy of the site.</div>}
        <Link to="/" className="v3-btn" style={{ height: 44, fontSize: 14 }}>Keep exploring the demo</Link>
        <div className="v3-sub" style={{ margin: 0, textAlign: 'center' }}>
          Need access? <a className="v3-link" href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Contact the owner</a> and mention the email you signed up with.
        </div>
      </Glass>
      <div className="v3-door-roles">
        {ROLES.map((r) => (
          <Glass key={r.name} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ alignSelf: 'flex-start' }}><Pill tone={r.tone}>{r.name}</Pill></span>
            <div className="v3-mut" style={{ fontSize: 13, lineHeight: 1.5 }}>{r.text}</div>
          </Glass>
        ))}
      </div>
    </section>
  );
}
