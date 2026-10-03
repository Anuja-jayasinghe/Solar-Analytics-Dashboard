// tests/access.test.js
//
// shared/domain/access.js: the mapping from Clerk metadata to an access level. The failure that
// matters is a user ending up with MORE access than intended, so the tests lean that way.

import { describe, it, expect } from 'vitest';
import { accessLevelFromMetadata, satisfiesLevel } from '../shared/domain/access.js';

describe('accessLevelFromMetadata', () => {
  it('admin role → admin', () => {
    expect(accessLevelFromMetadata({ role: 'admin' })).toBe('admin');
  });
  it('viewer role → viewer', () => {
    expect(accessLevelFromMetadata({ role: 'viewer' })).toBe('viewer');
  });
  it('legacy dashboardAccess "real" → viewer (until the P4 migration)', () => {
    expect(accessLevelFromMetadata({ dashboardAccess: 'real' })).toBe('viewer');
  });
  it('admin wins when both are present', () => {
    expect(accessLevelFromMetadata({ role: 'admin', dashboardAccess: 'demo' })).toBe('admin');
  });
  it('anything else is none (the demo)', () => {
    expect(accessLevelFromMetadata({})).toBe('none');
    expect(accessLevelFromMetadata({ dashboardAccess: 'demo' })).toBe('none');
    expect(accessLevelFromMetadata({ role: 'Admin' })).toBe('none'); // case-sensitive, no fuzzy matching
    expect(accessLevelFromMetadata({ role: ['admin'] })).toBe('none');
    expect(accessLevelFromMetadata({ role: true })).toBe('none');
    expect(accessLevelFromMetadata(null)).toBe('none');
    expect(accessLevelFromMetadata(undefined)).toBe('none');
    expect(accessLevelFromMetadata('admin')).toBe('none');
  });
});

describe('satisfiesLevel', () => {
  it('admin satisfies everything; viewer satisfies viewer only; none satisfies nothing above none', () => {
    expect(satisfiesLevel('admin', 'admin')).toBe(true);
    expect(satisfiesLevel('admin', 'viewer')).toBe(true);
    expect(satisfiesLevel('viewer', 'viewer')).toBe(true);
    expect(satisfiesLevel('viewer', 'admin')).toBe(false);
    expect(satisfiesLevel('none', 'viewer')).toBe(false);
    expect(satisfiesLevel('none', 'admin')).toBe(false);
  });
  it('unknown levels never satisfy (fail closed)', () => {
    expect(satisfiesLevel('superuser', 'viewer')).toBe(false);
    expect(satisfiesLevel('admin', 'root')).toBe(false);
    expect(satisfiesLevel(undefined, 'viewer')).toBe(false);
  });
});

import { validateAccessPatch, planRoleMigration, ASSIGNABLE_ROLES } from '../shared/domain/access.js';

describe('validateAccessPatch', () => {
  const ctx = { actorId: 'admin_1', targetId: 'user_2' };

  it('accepts known roles; "user" removes the key (null)', () => {
    expect(validateAccessPatch({ role: 'viewer' }, ctx)).toEqual({ ok: true, patch: { role: 'viewer' } });
    expect(validateAccessPatch({ role: 'admin' }, ctx)).toEqual({ ok: true, patch: { role: 'admin' } });
    expect(validateAccessPatch({ role: 'user' }, ctx)).toEqual({ ok: true, patch: { role: null } });
    expect(ASSIGNABLE_ROLES).toContain('viewer');
  });

  it('rejects a typo or unknown value instead of silently stripping access', () => {
    for (const role of ['Admin', 'ADMIN', 'superuser', '', ' admin', ['admin'], 1, true, null]) {
      const r = validateAccessPatch({ role }, ctx);
      expect(r.ok, String(role)).toBe(false);
      expect(r.status).toBe(400);
    }
    expect(validateAccessPatch({ dashboardAccess: 'full' }, ctx).ok).toBe(false);
  });

  it('requires at least one change and a body object', () => {
    for (const b of [undefined, null, {}, [], 'role', 5]) expect(validateAccessPatch(b, ctx).ok).toBe(false);
  });

  it('forbids an admin removing their OWN admin role (lock-out guard), but not granting it', () => {
    const self = { actorId: 'admin_1', targetId: 'admin_1' };
    expect(validateAccessPatch({ role: 'viewer' }, self)).toMatchObject({ ok: false, status: 400 });
    expect(validateAccessPatch({ role: 'user' }, self).ok).toBe(false);
    expect(validateAccessPatch({ role: 'admin' }, self).ok).toBe(true);
    expect(validateAccessPatch({ dashboardAccess: 'real' }, self).ok).toBe(true);
  });

  it('does not let extra/unknown keys through into the patch', () => {
    const r = validateAccessPatch({ role: 'viewer', isSuperAdmin: true, publicMetadata: { role: 'admin' } }, ctx);
    expect(r.patch).toEqual({ role: 'viewer' });
  });
});

describe('planRoleMigration', () => {
  it('turns legacy "real" users into viewers and leaves everyone else alone', () => {
    const plan = planRoleMigration([
      { id: 'a', publicMetadata: { role: 'admin', dashboardAccess: 'real' } },
      { id: 'b', publicMetadata: { dashboardAccess: 'real' } },
      { id: 'c', publicMetadata: { role: 'viewer' } },
      { id: 'd', publicMetadata: { dashboardAccess: 'demo' } },
      { id: 'e', publicMetadata: {} },
      { id: 'f' },
      { id: 'g', publicMetadata: { role: 'user', dashboardAccess: 'real' } }
    ]);
    expect(plan).toEqual([{ id: 'b', from: null, to: 'viewer' }, { id: 'g', from: 'user', to: 'viewer' }]);
  });
  it('is idempotent: applying the plan leaves nothing further to do', () => {
    const users = [{ id: 'b', publicMetadata: { dashboardAccess: 'real' } }];
    const migrated = users.map((u) => ({ ...u, publicMetadata: { ...u.publicMetadata, role: 'viewer' } }));
    expect(planRoleMigration(users)).toHaveLength(1);
    expect(planRoleMigration(migrated)).toEqual([]);
  });
  it('survives empty input', () => {
    expect(planRoleMigration(undefined)).toEqual([]);
  });
});
