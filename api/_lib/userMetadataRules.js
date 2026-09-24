// api/_lib/userMetadataRules.js
//
// Validation for the two Clerk `publicMetadata` fields the admin screen may change.
//
// Kept apart from the handler so it can be unit-tested without Clerk. The handler used to copy
// whatever `role` / `dashboardAccess` the request carried straight into publicMetadata, so a typo
// (or a hostile value such as an object) was stored verbatim — and `role` is the value
// verifyAdminToken authorizes on.

export const ALLOWED_ROLES = ['user', 'admin'];
export const ALLOWED_ACCESS_LEVELS = ['demo', 'real'];

/**
 * Validate a PATCH body.
 *
 * @param {unknown} body            req.body
 * @param {{ targetUserId: string, actingUserId: string }} ctx
 * @returns {{ ok: true, updates: {role?: string, dashboardAccess?: string} } | { ok: false, error: string }}
 */
export function validateUserPatch(body, { targetUserId, actingUserId }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const { role, dashboardAccess } = body;

  if (role === undefined && dashboardAccess === undefined) {
    return { ok: false, error: 'No updates provided' };
  }

  const updates = {};

  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      return { ok: false, error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` };
    }
    // An admin demoting themselves is the one way the last admin can disappear: the acting
    // admin is by definition an admin, so refusing this keeps at least one in place.
    if (targetUserId === actingUserId && role !== 'admin') {
      return { ok: false, error: 'You cannot remove your own admin role' };
    }
    updates.role = role;
  }

  if (dashboardAccess !== undefined) {
    if (!ALLOWED_ACCESS_LEVELS.includes(dashboardAccess)) {
      return {
        ok: false,
        error: `dashboardAccess must be one of: ${ALLOWED_ACCESS_LEVELS.join(', ')}`
      };
    }
    updates.dashboardAccess = dashboardAccess;
  }

  return { ok: true, updates };
}
