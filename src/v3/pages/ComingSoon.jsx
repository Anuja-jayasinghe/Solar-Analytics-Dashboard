import { Glass } from '../ui/Glass.jsx';

/** Placeholder for a page whose slice has not landed yet. Names the slice so progress is visible. */
export default function ComingSoon({ slice, children }) {
  return (
    <Glass card>
      <h2 className="v3-h2">Coming in the “{slice}” slice</h2>
      <div className="v3-sub">{children}</div>
    </Glass>
  );
}
