// tests/errorReporting.test.js — every browser error funnels through reportError().

import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportError, setErrorReporter } from '../src/v3/ui/errorReporting.js';

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
