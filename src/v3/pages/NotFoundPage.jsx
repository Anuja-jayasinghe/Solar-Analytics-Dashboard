import { Link, useLocation } from 'react-router-dom';
import { Glass } from '../ui/Glass.jsx';

/** A real 404: says the page is not here, shows what was asked for, and offers the way back. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <Glass card aria-labelledby="nf-title" style={{ alignItems: 'flex-start' }}>
      <div className="v3-num" style={{ fontSize: 56, lineHeight: 1, color: 'var(--gen)' }} aria-hidden="true">404</div>
      <div>
        <h2 id="nf-title" className="v3-h2" style={{ fontSize: 22 }}>This page does not exist</h2>
        <div className="v3-sub">There is nothing at <code>{pathname}</code>. It may have moved, or the address may be mistyped.</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/" className="v3-btn primary">Go to the Overview</Link>
        <Link to="/pro" className="v3-btn">Pro metrics</Link>
      </div>
    </Glass>
  );
}
