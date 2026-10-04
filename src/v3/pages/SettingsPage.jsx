import { useMemo } from 'react';
import { useTheme } from '../theme/context.js';
import { useAccess } from '../access/context.js';
import { useResource } from '../data/context.js';
import { createSettingsWriter } from '../data/client.js';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { PlantCard } from '../settings/PlantCard.jsx';
import { AccountCard } from '../settings/AccountCard.jsx';

/**
 * Settings: appearance (everyone), plant values (admin edits, others read), account, and what is planned.
 * Writes go to the admin-only PUT /api/settings; the server re-checks the role.
 */
export default function SettingsPage() {
  const { theme, themes, setTheme } = useTheme();
  const { level, email, getToken, signIn, signOut } = useAccess();
  const settings = useResource('settings');
  const canEdit = level === 'admin';
  const writer = useMemo(() => createSettingsWriter({ getToken }), [getToken]);

  const save = async (changes) => {
    try {
      for (const c of changes) await writer(c.name, c.value);
    } finally {
      await settings.refresh(); // show what the server actually holds, success or not
    }
  };

  return (
    <>
      <Glass card aria-label="Appearance">
        <div>
          <h2 className="v3-h2">Appearance</h2>
          <div className="v3-sub">Every theme is a set of colour variables, so new ones appear here without changing any screen.</div>
        </div>
        <div role="radiogroup" aria-label="Theme" className="v3-themegrid">
          {themes.map((t) => {
            const on = t.id === theme;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} className="v3-themecard" data-on={on} onClick={() => setTheme(t.id)}>
                <div className="v3-themeprev" style={{ background: t.preview.bg }}>
                  <i style={{ left: 10, top: 10, width: 54, height: 26, background: t.preview.glass }} />
                  <i style={{ left: 70, top: 10, width: 54, height: 26, background: t.preview.glass }} />
                  <i style={{ left: 10, bottom: 10, right: 10, height: 26, background: t.preview.glass }} />
                  <b style={{ right: 12, top: 12, width: 16, height: 16, background: t.preview.gen }} />
                  <b style={{ right: 36, top: 16, width: 10, height: 10, background: t.preview.ceb }} />
                </div>
                <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700 }}>{t.name}{on ? ' · selected' : ''}</div>
                <div className="v3-mut" style={{ fontSize: 11.5 }}>{t.note}</div>
              </button>
            );
          })}
        </div>
      </Glass>

      {settings.error ? <Note tone="bad">Could not load the plant settings ({settings.error.code ?? 'error'}).</Note> : (
        <PlantCard settings={settings.data?.settings ?? null} loading={settings.loading} canEdit={canEdit} onSave={save} />
      )}

      <AccountCard level={level} email={email} onSignIn={signIn} onSignOut={signOut} />

      <Glass card aria-label="Planned">
        <div className="v3-tilehead">
          <div>
            <h2 className="v3-h2">Fault alerts</h2>
            <div className="v3-sub">Email or push when the inverter stops. Planned (issue 151); the data it needs is already collected.</div>
          </div>
          <Pill>Coming later</Pill>
        </div>
      </Glass>
    </>
  );
}
