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
