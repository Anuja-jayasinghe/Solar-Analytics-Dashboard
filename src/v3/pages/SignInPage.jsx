import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAccess } from '../access/context.js';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';

const ROLES = [
  { tone: undefined, name: 'Visitor', text: 'Sees every page on demo data dated 2035 onwards. Nothing real is exposed or even sent to the browser.' },
  { tone: 'ceb', name: 'Viewer', text: 'Invited by the owner. Real data, read only, including Pro metrics.' },
  { tone: 'gen', name: 'Admin', text: 'Everything a viewer sees, plus bill upload and approval, access, plant settings and data health.' }
];

/** The doorway. Clerk handles the actual sign-in; without a Clerk key the button is absent and the demo remains. */
export default function SignInPage() {
  const { level, signIn } = useAccess();
  const location = useLocation();
  if (level === 'viewer' || level === 'admin') return <Navigate to={location.state?.from || '/'} replace />;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 30 }}>
      <Glass style={{ width: '100%', maxWidth: 440, padding: '34px 32px', display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'center' }}>
        <span className="v3-brand-mark" style={{ alignSelf: 'center', width: 44, height: 44, borderRadius: 13, fontSize: 22 }} aria-hidden="true">S</span>
        <div>
          <h2 className="v3-h2" style={{ fontSize: 22 }}>Sign in for the live plant</h2>
          <div className="v3-sub">Invite only. Without signing in you can still explore everything on demo data.</div>
        </div>
        {signIn && <button type="button" className="v3-btn primary" style={{ height: 44, fontSize: 14 }} onClick={signIn}>Sign in</button>}
        <Link to="/" className="v3-btn" style={{ height: 44, fontSize: 14 }}>Keep exploring the demo</Link>
        <div className="v3-sub" style={{ margin: 0 }}>Need access? Ask the owner to invite your email.</div>
      </Glass>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, width: '100%' }}>
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
