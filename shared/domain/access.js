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

/** Roles an admin may assign. 'user' means "no dashboard role". Validation lives in api/_lib/userMetadataRules.js. */
export const ASSIGNABLE_ROLES = Object.freeze(['user', 'viewer', 'admin']);
/** Legacy flag values; kept writable only until the P4 migration retires the flag. */
export const DASHBOARD_ACCESS_VALUES = Object.freeze(['demo', 'real']);

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
