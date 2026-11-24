// tests/errorReporting.test.js — every browser error funnels through reportError().

import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportError, setErrorReporter, createBeaconReporter } from '../src/v3/ui/errorReporting.js';

afterEach(() => {
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe('reportError()', () => {
  it('logs, and forwards to the registered reporter with its context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reporter = vi.fn();
    setErrorReporter(reporter);

    const error = new Error('boom');
    reportError(error, { source: 'ErrorBoundary' });

    expect(console.error).toHaveBeenCalled();
    expect(reporter).toHaveBeenCalledWith(error, { source: 'ErrorBoundary' });
  });

  it('wraps a non-Error reason (e.g. a rejected string) in an Error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reporter = vi.fn();
    setErrorReporter(reporter);

    reportError('plain string', { source: 'unhandledrejection' });

    expect(reporter.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(reporter.mock.calls[0][0].message).toBe('plain string');
  });

  it('never throws when the reporter itself fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setErrorReporter(() => { throw new Error('tracker down'); });

    expect(() => reportError(new Error('boom'), { source: 'x' })).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it('only logs when no reporter is registered', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });
});

describe('createBeaconReporter() (#241)', () => {
  it('posts the message, stack, source, path and release to /api/ops/error', () => {
    const send = vi.fn();
    const report = createBeaconReporter({ release: '3.5.0', send, path: () => '/explore' });
    const error = new Error('boom');
    report(error, { source: 'window.error', file: 'https://s/assets/a.js', line: 4 });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, body] = send.mock.calls[0];
    expect(url).toBe('/api/ops/error');
    expect(JSON.parse(body)).toMatchObject({ message: 'boom', source: 'window.error', route: '/explore', release: '3.5.0', file: 'https://s/assets/a.js', line: 4 });
    expect(JSON.parse(body).stack).toContain('boom');
  });

  it('sends each message once and at most maxPerPage reports', () => {
    const send = vi.fn();
    const report = createBeaconReporter({ send, maxPerPage: 3, path: () => '/' });
    for (let i = 0; i < 5; i++) report(new Error('same'));
    for (let i = 0; i < 5; i++) report(new Error(`e${i}`));
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('carries no user identity', () => {
    const send = vi.fn();
    createBeaconReporter({ send, path: () => '/' })(new Error('x'), { source: 's', user: { id: 'user_1', email: 'a@example.com' } });
    expect(send.mock.calls[0][1]).not.toMatch(/user_1|example\.com/);
  });
});
