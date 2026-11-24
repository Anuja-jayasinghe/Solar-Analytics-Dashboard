// tests/logPersist.test.js — api/_lib/log.js writing durable copies to Supabase (#241): one warning for a
// missing table, then no further attempts; other errors warn and never throw.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
vi.mock('../api/_lib/supabaseServer.js', () => ({ supabase: { from: () => ({ insert }) } }));

const { __test, setLogSink } = await import('../api/_lib/log.js');

beforeEach(() => {
  insert.mockReset();
  setLogSink(null);
  vi.restoreAllMocks();
});

describe('insertRow', () => {
  it('warns once for a missing table and stops trying', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    insert.mockResolvedValue({ error: { code: '42P01', message: 'relation "public.request_log" does not exist' } });
    await __test.insertRow('request_log', { route: 'x' });
    await __test.insertRow('request_log', { route: 'y' });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('request_log does not exist yet');
  });

  it('warns and keeps trying after other errors, and never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    insert.mockResolvedValueOnce({ error: { code: '57014', message: 'timeout' } }).mockRejectedValueOnce(new Error('network'));
    await expect(__test.insertRow('admin_audit_log', {})).resolves.toBeUndefined();
    await expect(__test.insertRow('admin_audit_log', {})).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('writes the row as given', async () => {
    insert.mockResolvedValue({ error: null });
    await __test.insertRow('request_log', { route: 'data/live', status: 200 });
    expect(insert).toHaveBeenCalledWith({ route: 'data/live', status: 200 });
  });
});

describe('insertRow after the migration lands', () => {
  it('tries a missing table again after 10 minutes, so a warm instance picks it up', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      insert.mockResolvedValueOnce({ error: { code: '42P01', message: 'relation does not exist' } }).mockResolvedValue({ error: null });
      await __test.insertRow('request_log', { n: 1 });
      vi.advanceTimersByTime(9 * 60 * 1000);
      await __test.insertRow('request_log', { n: 2 });
      expect(insert).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2 * 60 * 1000);
      await __test.insertRow('request_log', { n: 3 });
      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert).toHaveBeenLastCalledWith({ n: 3 });
    } finally {
      vi.useRealTimers();
    }
  });
});
