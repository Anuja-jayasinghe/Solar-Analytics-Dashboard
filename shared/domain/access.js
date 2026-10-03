// shared/domain/access.js
//
// Who may see what (decision D-3): `admin` manages data, settings and users; invited read-only
// `viewer`s see the dashboards; everyone else is `none` and gets the demo.
//
// Pure: it maps Clerk `publicMetadata` to a level. Enforcement happens SERVER-SIDE only
// (api/_lib/verifyAdminToken.js → verifyAccess); the browser may use the same function to decide
// what to render, but that is a convenience, never a control.

export const ACCESS_LEVELS = Object.freeze({ none: 0, viewer: 1, admin: 2 });

/**
 * @param {object|null|undefined} publicMetadata  Clerk user.publicMetadata
 * @returns {'none'|'viewer'|'admin'}
 */
export function accessLevelFromMetadata(publicMetadata) {
  if (!publicMetadata || typeof publicMetadata !== 'object') return 'none';
  if (publicMetadata.role === 'admin') return 'admin';
  if (publicMetadata.role === 'viewer') return 'viewer';
  // Legacy flag set by the existing user-management screen. Treated as viewer until the P4
  // migration moves every user to `role` (issue #158), after which this line is removed.
  if (publicMetadata.dashboardAccess === 'real') return 'viewer';
  return 'none';
}

/** Roles an admin may assign. 'user' means "no dashboard role" (stored as the key being removed). */
export const ASSIGNABLE_ROLES = Object.freeze(['admin', 'viewer', 'user']);
/** Legacy flag values; kept writable only until the P4 migration retires the flag. */
export const DASHBOARD_ACCESS_VALUES = Object.freeze(['real', 'demo']);

/**
 * Validate an admin's request to change a user's access. Pure, so the rules are tested.
 *
 * Guards against two failure modes: a typo silently stripping someone's access (only known values
 * are accepted), and an admin removing their OWN admin role, which can leave nobody able to
 * administer the system.
 *
 * @returns {{ok:true, patch:object}|{ok:false, status:number, error:string}}
 */
export function validateAccessPatch(body, { actorId, targetId }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'No updates provided' };
  const { role, dashboardAccess } = body;
  if (role === undefined && dashboardAccess === undefined) return { ok: false, status: 400, error: 'No updates provided' };

  const patch = {};
  if (role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, status: 400, error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` };
    if (actorId && actorId === targetId && role !== 'admin') {
      return { ok: false, status: 400, error: 'You cannot remove your own admin role' };
    }
    patch.role = role === 'user' ? null : role; // null removes the key from Clerk metadata
  }
  if (dashboardAccess !== undefined) {
    if (!DASHBOARD_ACCESS_VALUES.includes(dashboardAccess)) {
      return { ok: false, status: 400, error: `dashboardAccess must be one of: ${DASHBOARD_ACCESS_VALUES.join(', ')}` };
    }
    patch.dashboardAccess = dashboardAccess;
  }
  return { ok: true, patch };
}

/**
 * Plan the one-off move from the legacy flag to `role` (issue #158). Users who already have a
 * role are untouched; a legacy "real" user becomes a viewer. The legacy flag is left in place so
 * the change is reversible. Returns only the changes to make.
 *
 * @param {{id:string, publicMetadata?:object}[]} users
 */
export function planRoleMigration(users) {
  const changes = [];
  for (const u of users ?? []) {
    const meta = u.publicMetadata ?? {};
    if (meta.role === 'admin' || meta.role === 'viewer') continue;
    if (meta.dashboardAccess === 'real') changes.push({ id: u.id, from: meta.role ?? null, to: 'viewer' });
  }
  return changes;
}

/** True when `actual` is at least `required` (admin satisfies viewer). Unknown levels never satisfy. */
export function satisfiesLevel(actual, required) {
  const a = ACCESS_LEVELS[actual];
  const r = ACCESS_LEVELS[required];
  if (a === undefined || r === undefined) return false;
  return a >= r;
}
