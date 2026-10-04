// src/v3/admin/users.js
//
// The Access tab's pure logic: which role a person has, what an admin may change, and how a row reads.
// The server is the control (api/admin/users/[userId].js refuses invalid roles and stops an admin removing
// their own admin role); this keeps the UI from offering what the server will refuse.

export const ROLE_OPTIONS = Object.freeze([
  { value: 'user', label: 'No access (demo)' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'admin', label: 'Admin' }
]);

const LEVEL_TO_ROLE = { none: 'user', viewer: 'viewer', admin: 'admin' };
export const roleOfLevel = (accessLevel) => LEVEL_TO_ROLE[accessLevel] ?? 'user';

export const levelLabel = (accessLevel) => ({ none: 'No access', viewer: 'Viewer', admin: 'Admin' }[accessLevel] ?? 'No access');

export function displayName(u) {
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
  return name || u?.email || 'Unnamed user';
}

/** Users for the table: admins first, then viewers, then the rest; people by name within a group. */
export function sortUsers(users) {
  const rank = { admin: 0, viewer: 1, none: 2 };
  return [...(users ?? [])].sort((a, b) => (rank[a.accessLevel] ?? 3) - (rank[b.accessLevel] ?? 3) || displayName(a).localeCompare(displayName(b)));
}

/** You cannot change your own role: that is how the last admin is protected. */
export function canChangeRole(user, meId) {
  return !!user && user.id !== meId;
}

/** Apply a saved role to the local list without waiting for a re-read. */
export function withRole(users, userId, role) {
  const level = role === 'user' ? 'none' : role;
  return (users ?? []).map((u) => (u.id === userId ? { ...u, role, accessLevel: level } : u));
}

export function roleProblem(err) {
  if (err?.status === 403) return 'Only an admin can change roles.';
  if (err?.status === 400) return err.message || 'That role change was refused.';
  return `Could not change the role (${err?.code ?? 'error'}).`;
}
