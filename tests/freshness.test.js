// tests/freshness.test.js
//
// shared/domain/freshness.js: the rules that decide whether the telemetry pipeline has silently
// stopped. Both directions matter: a false alarm on day one trains people to ignore the issue,
// and a missed alarm repeats the five-month outage this check was created for.

import { describe, it, expect } from 'vitest';
import { evaluateCollectorRuns, evaluateUptimeFreshness } from '../shared/domain/freshness.js';

const NOW = Date.parse('2026-10-04T06:00:00Z');
const run = (status, iso) => ({ status, started_at: iso });

describe('evaluateCollectorRuns', () => {
  it('not armed + never run → ok but marked skipped (no false outage on deploy)', () => {
    const r = evaluateCollectorRuns({ latestRun: null, latestOkRun: null, nowMs: NOW, required: false });
    expect(r).toMatchObject({ ok: true, skipped: true });
  });

  it('armed + never run → fails (a collector nobody wired up must not stay invisible)', () => {
    const r = evaluateCollectorRuns({ latestRun: null, latestOkRun: null, nowMs: NOW, required: true });
    expect(r.ok).toBe(false);
  });

  it('a recent successful run is healthy', () => {
    const ok = run('ok', '2026-10-03T18:45:00Z');
    const r = evaluateCollectorRuns({ latestRun: ok, latestOkRun: ok, nowMs: NOW });
    expect(r.ok).toBe(true);
    expect(r.ageHours).toBeCloseTo(11.3, 1);
  });

  it('a stale successful run fails with the age in the reason', () => {
    const ok = run('ok', '2026-10-01T18:45:00Z');
    const r = evaluateCollectorRuns({ latestRun: ok, latestOkRun: ok, nowMs: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/hours ago/);
  });

  it('the newest run having failed fails the check even if an older run succeeded recently', () => {
    const r = evaluateCollectorRuns({
      latestRun: run('failed', '2026-10-04T05:00:00Z'), latestOkRun: run('ok', '2026-10-03T18:45:00Z'), nowMs: NOW
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/failed/);
  });

  it("an 'empty' run (processed nothing) is a failure, not success", () => {
    const r = evaluateCollectorRuns({ latestRun: run('empty', '2026-10-04T05:00:00Z'), latestOkRun: null, nowMs: NOW });
    expect(r.ok).toBe(false);
  });

  it('a run still marked running with no successful run before it fails: nothing has ever completed', () => {
    const r = evaluateCollectorRuns({ latestRun: run('running', '2026-10-04T05:00:00Z'), latestOkRun: null, nowMs: NOW });
    expect(r.ok).toBe(false);
  });
});

describe('evaluateUptimeFreshness', () => {
  it('not armed + empty → skipped; armed + empty → fails', () => {
    expect(evaluateUptimeFreshness({ latestDay: null, todayKey: '2026-10-04' })).toMatchObject({ ok: true, skipped: true });
    expect(evaluateUptimeFreshness({ latestDay: null, todayKey: '2026-10-04', required: true }).ok).toBe(false);
  });

  it('yesterday is fresh; two days old is still within the default limit; three is stale', () => {
    expect(evaluateUptimeFreshness({ latestDay: '2026-10-03', todayKey: '2026-10-04' }).ok).toBe(true);
    expect(evaluateUptimeFreshness({ latestDay: '2026-10-02', todayKey: '2026-10-04' }).ok).toBe(true);
    const stale = evaluateUptimeFreshness({ latestDay: '2026-10-01', todayKey: '2026-10-04' });
    expect(stale.ok).toBe(false);
    expect(stale.ageDays).toBe(3);
  });
});
