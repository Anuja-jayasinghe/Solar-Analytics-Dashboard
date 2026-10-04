import { useTheme } from '../theme/context.js';
import { Glass } from '../ui/Glass.jsx';
import ComingSoon from './ComingSoon.jsx';

/** Settings. Appearance is live in the foundation; plant settings and preferences arrive in the settings-door slice. */
export default function SettingsPage() {
  const { theme, themes, setTheme } = useTheme();
  return (
    <>
      <Glass card aria-label="Appearance">
        <div>
          <h2 className="v3-h2">Appearance</h2>
          <div className="v3-sub">Every theme is a set of colour variables, so new ones appear here without changing any screen.</div>
        </div>
        <div role="radiogroup" aria-label="Theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 14 }}>
          {themes.map((t) => {
            const on = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme(t.id)}
                style={{ textAlign: 'left', borderRadius: 18, padding: 12, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', background: 'var(--chip-bg)', border: `2px solid ${on ? 'var(--gen)' : 'var(--glass-line)'}` }}
              >
                <div style={{ height: 86, borderRadius: 12, position: 'relative', overflow: 'hidden', background: t.preview.bg }}>
                  <div style={{ position: 'absolute', left: 10, top: 10, width: 54, height: 26, borderRadius: 8, background: t.preview.glass }} />
                  <div style={{ position: 'absolute', left: 70, top: 10, width: 54, height: 26, borderRadius: 8, background: t.preview.glass }} />
                  <div style={{ position: 'absolute', left: 10, bottom: 10, right: 10, height: 26, borderRadius: 8, background: t.preview.glass }} />
                  <div style={{ position: 'absolute', right: 12, top: 12, width: 16, height: 16, borderRadius: '50%', background: t.preview.gen }} />
                  <div style={{ position: 'absolute', right: 36, top: 16, width: 10, height: 10, borderRadius: '50%', background: t.preview.ceb }} />
                </div>
                <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700 }}>{t.name}{on ? ' · selected' : ''}</div>
                <div className="v3-mut" style={{ fontSize: 11.5 }}>{t.note}</div>
              </button>
            );
          })}
        </div>
      </Glass>
      <ComingSoon slice="settings-door">Plant settings (admin) and preferences.</ComingSoon>
    </>
  );
}
