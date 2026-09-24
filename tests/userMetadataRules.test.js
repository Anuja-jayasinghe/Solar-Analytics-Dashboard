// tests/userMetadataRules.test.js
//
// `role` is the value verifyAdminToken authorizes on, so what may be written to it is a
// security boundary. The handler used to store whatever the request carried.

import { describe, it, expect } from 'vitest';
import { validateUserPatch } from '../api/_lib/userMetadataRules.js';

const ctx = { targetUserId: 'user_target', actingUserId: 'user_admin' };

describe('validateUserPatch', () => {
  it('accepts a valid role change', () => {
    expect(validateUserPatch({ role: 'admin' }, ctx)).toEqual({ ok: true, updates: { role: 'admin' } });
  });

  it('accepts a valid access change', () => {
    expect(validateUserPatch({ dashboardAccess: 'real' }, ctx)).toEqual({
      ok: true,
      updates: { dashboardAccess: 'real' }
    });
  });

  it('accepts both fields together', () => {
    const result = validateUserPatch({ role: 'user', dashboardAccess: 'demo' }, ctx);
    expect(result).toEqual({ ok: true, updates: { role: 'user', dashboardAccess: 'demo' } });
  });

  it.each([
    ['unknown role', { role: 'superadmin' }],
    ['non-string role', { role: { $ne: null } }],
    ['array role', { role: ['admin'] }],
    ['empty-string role', { role: '' }],
    ['unknown access level', { dashboardAccess: 'full' }],
    ['non-string access level', { dashboardAccess: true }]
  ])('rejects %s', (_label, body) => {
    expect(validateUserPatch(body, ctx).ok).toBe(false);
  });

  it('rejects a body with nothing to update', () => {
    expect(validateUserPatch({}, ctx)).toEqual({ ok: false, error: 'No updates provided' });
  });

  it.each([[undefined], [null], ['role=admin'], [[]]])('rejects a non-object body (%s)', (body) => {
    expect(validateUserPatch(body, ctx).ok).toBe(false);
  });

  it('refuses to let an admin remove their own admin role', () => {
    const self = { targetUserId: 'user_admin', actingUserId: 'user_admin' };
    const result = validateUserPatch({ role: 'user' }, self);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/own admin role/);
  });

  it('lets an admin keep their own admin role and change their own access', () => {
    const self = { targetUserId: 'user_admin', actingUserId: 'user_admin' };
    expect(validateUserPatch({ role: 'admin' }, self).ok).toBe(true);
    expect(validateUserPatch({ dashboardAccess: 'real' }, self).ok).toBe(true);
  });

  it('lets an admin demote somebody else', () => {
    expect(validateUserPatch({ role: 'user' }, ctx).ok).toBe(true);
  });
});
