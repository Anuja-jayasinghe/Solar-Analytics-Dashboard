// tests/solisEndpointsConfig.test.js
//
// The parameter schema is the only thing between an admin's request and SolisCloud, signed with
// our API credentials.

import { describe, it, expect } from 'vitest';
import config from '../api/_config/solisEndpointsConfig.js';
import validator from '../api/_lib/solisExplorerValidator.js';

describe('endpoint lookup', () => {
  it('finds a declared endpoint', () => {
    expect(config.getEndpointConfig('inverterDay').path).toBe('/v1/api/inverterDay');
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'validateParams', 'getEndpointConfig'])(
    'does not resolve %s as an endpoint',
    (key) => {
      expect(config.getEndpointConfig(key)).toBeNull();
      expect(validator.validateRequest(key, {}).valid).toBe(false);
    }
  );

  it('rejects non-string keys', () => {
    expect(config.getEndpointConfig(undefined)).toBeNull();
    expect(config.getEndpointConfig({})).toBeNull();
  });
});

describe('validateParams', () => {
  it('applies defaults and forwards only declared parameters', () => {
    const result = config.validateParams('inverterDay', { sn: 'ABC', time: '2026-09-01', injected: 'x' });
    expect(result.valid).toBe(true);
    expect(result.validated).toEqual({ sn: 'ABC', time: '2026-09-01', timeZone: '8' });
  });

  it('requires required parameters', () => {
    expect(config.validateParams('inverterDay', { sn: 'ABC' }).errors).toContain('Missing required parameter: time');
  });

  it.each([
    ['a date in the wrong shape', { time: '01/09/2026' }],
    ['a date with trailing junk', { time: '2026-09-01; drop' }],
    ['a non-string date', { time: 20260901 }]
  ])('rejects %s', (_label, params) => {
    expect(config.validateParams('inverterDay', { sn: 'ABC', ...params }).valid).toBe(false);
  });

  it('enforces the documented page-size maximum', () => {
    expect(config.validateParams('alarmList', { pageSize: '100' }).valid).toBe(true);
    expect(config.validateParams('alarmList', { pageSize: '101' }).valid).toBe(false);
    expect(config.validateParams('alarmList', { pageSize: '0' }).valid).toBe(false);
    expect(config.validateParams('alarmList', { pageSize: '10.5' }).valid).toBe(false);
  });

  it('rejects falsy non-string values instead of skipping them', () => {
    expect(config.validateParams('alarmList', { pageSize: 0 }).valid).toBe(false);
    expect(config.validateParams('alarmList', { stationId: false }).valid).toBe(false);
  });

  it('rejects over-long values', () => {
    expect(config.validateParams('stationDetail', { id: 'x'.repeat(65) }).valid).toBe(false);
  });

  it('allows fractional timezone offsets', () => {
    expect(config.validateParams('inverterDay', { sn: 'A', time: '2026-09-01', timeZone: '5.5' }).valid).toBe(true);
  });
});
