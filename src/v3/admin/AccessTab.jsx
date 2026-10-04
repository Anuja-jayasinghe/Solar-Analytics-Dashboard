import { useState } from 'react';
import { Glass } from '../ui/Glass.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { useAccess } from '../access/context.js';
import { ROLE_OPTIONS, canChangeRole, displayName, levelLabel, roleOfLevel, roleProblem, sortUsers, withRole } from './users.js';
import { useAdminApi, useAdminLoad } from './useAdmin.js';

/** Who can see the real data. Roles are saved through the admin API; you cannot change your own. */
export function AccessTab() {
  const api = useAdminApi();
  const { userId } = useAccess();
  const list = useAdminLoad(() => api.listUsers());
  const [users, setUsers] = useState(null);
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState(null);
  const shown = sortUsers(users ?? list.data?.users);

  const change = async (u, role) => {
    setSaving(u.id);
    setProblem(null);
    try {
      await api.setRole(u.id, role);
      setUsers(withRole(shown, u.id, role));
    } catch (err) {
      setProblem(roleProblem(err));
    }
    setSaving(null);
  };

  return (
    <Glass card aria-label="Who can see the real data" style={{ gap: 14 }}>
      <div>
        <h2 className="v3-h2">Who can see the real data</h2>
        <div className="v3-sub">Everyone else sees demo data dated 2035 onwards. Viewers read; admins also manage bills, settings and people.</div>
      </div>
      {list.error && <Note tone="bad">Could not load people ({list.error.code ?? 'error'}).</Note>}
      {problem && <Note tone="bad">{problem}</Note>}
      {list.loading && !list.data && <div className="v3-skeleton" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />}
      {shown.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="v3-table">
            <caption className="v3-sr">People and their access</caption>
            <thead><tr><th scope="col">Person</th><th scope="col">Now</th><th scope="col">Change to</th></tr></thead>
            <tbody>
              {shown.map((u) => {
                const me = !canChangeRole(u, userId);
                return (
                  <tr key={u.id}>
                    <th scope="row">{displayName(u)}{me ? ' (you)' : ''}<div className="v3-mut" style={{ fontWeight: 400, fontSize: 11.5 }}>{u.email ?? ''}</div></th>
                    <td><Pill tone={u.accessLevel === 'admin' ? 'gen' : u.accessLevel === 'viewer' ? 'ceb' : undefined}>{levelLabel(u.accessLevel)}</Pill></td>
                    <td>
                      <select className="v3-field" value={roleOfLevel(u.accessLevel)} disabled={me || saving === u.id} aria-label={`Role for ${displayName(u)}`} onChange={(e) => change(u, e.target.value)}>
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="v3-sub" style={{ margin: 0 }}>People sign up themselves, then appear here as "No access" until you make them a viewer. Sending invitations from here is not built yet.</div>
    </Glass>
  );
}
