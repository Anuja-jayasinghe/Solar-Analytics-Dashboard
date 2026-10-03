// shared/domain/uptime.js
//
// LR-002: inverter uptime and interruptions.
// Spec: docs/logic-registry/LR-002-inverter-uptime-and-interruptions.md
// Tests: tests/uptime.test.js (the spec's acceptance criteria, plus replays of real probe days)
//
// Pure: no I/O, no Date.now(), no dependencies. The same code runs in the nightly collector,
// the API and the browser, so a number can never differ between them.
//
// Inputs are NORMALISED records (see solisNormalize.js):
//   points    [{ ts }]                                  inverter telemetry instants (epoch ms)
//   alarms    [{ code, beginMs, endMs|null, open }] | null   null = "could not be fetched"
//   collector [{ ts }] | null | undefined               logger heartbeats; null/undefined = unknown
//
// Three evidence states are kept distinct on purpose, because conflating them fabricates data:
//   alarms:    null  = unknown      []  = fetched, none occurred
//   collector: null  = unknown      []  = fetched, logger silent
//   uptimePct: null  = not knowable 0   = measured total outage

import { operatingWindow } from './time.js';

const MIN = 60_000;
const DEFAULT_CADENCE_MIN = 5;
const MIN_CADENCE_MIN = 1;
const MAX_CADENCE_MIN = 30;
const MIN_THRESHOLD_MIN = 10;
const THRESHOLD_CADENCES = 3;
const MIN_USABLE_GAPS = 2;
const EPS_MS = 1_000; // pieces shorter than a second are rounding noise

/**
 * Alarms that describe the LOGGER's cloud link, not the inverter (LR-002 observed fact 4).
 * 1D4C2 "Loss of internet connection": the inverter keeps generating and the logger uploads the
 * buffered points later. These are evidence for classifying a gap, never downtime themselves.
 */
const COMMS_ALARM_CODES = new Set(['1D4C2']);

export function isCommsAlarmCode(code) {
  return COMMS_ALARM_CODES.has(String(code ?? '').trim().toUpperCase());
}

export function causeForAlarmCode(code) {
  const c = code === null || code === undefined ? '' : String(code);
  if (c === '1011') return 'grid_undervoltage';
  if (c === '1010') return 'grid_overvoltage';
  return 'fault';
}

const round1 = (n) => Math.round(n * 10) / 10;

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Merge overlapping/adjacent intervals. Each item: { startMs, endMs, ...meta }. */
function mergeIntervals(items) {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  const out = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && it.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, it.endMs);
      last.codes.push(...it.codes);
      last.open = last.open || it.open;
    } else {
      out.push({ ...it, codes: [...it.codes] });
    }
  }
  return out;
}

/** Parts of [startMs, endMs] not covered by the (merged, sorted) `cuts`. */
function subtract(startMs, endMs, cuts) {
  const pieces = [];
  let cursor = startMs;
  for (const c of cuts) {
    if (c.endMs <= cursor) continue;
    if (c.startMs >= endMs) break;
    if (c.startMs > cursor) pieces.push({ startMs: cursor, endMs: Math.min(c.startMs, endMs) });
    cursor = Math.max(cursor, c.endMs);
    if (cursor >= endMs) break;
  }
  if (cursor < endMs) pieces.push({ startMs: cursor, endMs });
  return pieces.filter((p) => p.endMs - p.startMs > EPS_MS);
}

/**
 * Was the logger reporting DURING the silent stretch? Heartbeats at the very ends do not count:
 * the instants just before and after a gap are the stop and the recovery, not the middle. So one
 * cadence is ignored at each end, unless the piece is too short to have an interior.
 */
function loggerAliveInside(loggerTs, piece, cadenceMs) {
  const margin = piece.endMs - piece.startMs > 2 * cadenceMs ? cadenceMs : 0;
  return loggerTs.some((t) => t > piece.startMs + margin && t < piece.endMs - margin);
}

function emptyResult(dateKey, status, extra = {}) {
  return {
    dateKey, status, uptimePct: null, windowStartMs: null, windowEndMs: null, windowMinutes: 0,
    pointCount: 0, cadenceMin: null, resolutionMin: null, lowConfidence: false,
    alarmsKnown: false, loggerKnown: false,
    minutes: { producing: 0, trip: 0, gap: 0, comms_lost: 0, edge_gap: 0 },
    tripCount: 0, gapCount: 0, commsLostCount: 0, segments: [], ...extra
  };
}

/**
 * Uptime and interruption analysis for one Colombo calendar day.
 *
 * @param {object} args
 * @param {string} args.dateKey   'YYYY-MM-DD'
 * @param {{ts:number}[]} args.points
 * @param {Array|null} args.alarms        see header: null = unknown, [] = none
 * @param {{ts:number}[]|null} [args.collector]
 * @param {number|null} [args.now]  epoch ms; ends open alarms. Defaults to the window end.
 */
export function deriveDayUptime({ dateKey, points, alarms, collector = null, now = null }) {
  const win = operatingWindow(dateKey);
  if (!win) return emptyResult(dateKey, 'no_window');

  const allTs = [...new Set((points ?? []).map((p) => p.ts))].sort((a, b) => a - b);
  const inWin = allTs.filter((t) => t >= win.startMs && t <= win.endMs);

  const alarmsKnown = Array.isArray(alarms);
  const loggerKnown = Array.isArray(collector);
  const loggerTs = loggerKnown ? collector.map((p) => p.ts).sort((a, b) => a - b) : [];
  const loggerAliveInWindow = loggerTs.some((t) => t >= win.startMs && t <= win.endMs);

  // --- R2: cadence and threshold -------------------------------------------------------------
  const gapsMin = [];
  for (let i = 1; i < inWin.length; i++) {
    const g = (inWin[i] - inWin[i - 1]) / MIN;
    if (g <= MAX_CADENCE_MIN) gapsMin.push(g);
  }
  gapsMin.sort((a, b) => a - b);
  let cadenceMin = DEFAULT_CADENCE_MIN;
  let lowConfidence = true;
  if (gapsMin.length >= MIN_USABLE_GAPS) {
    cadenceMin = round1(Math.min(MAX_CADENCE_MIN, Math.max(MIN_CADENCE_MIN, median(gapsMin))));
    lowConfidence = false;
  }
  const thresholdMin = round1(Math.max(THRESHOLD_CADENCES * cadenceMin, MIN_THRESHOLD_MIN));
  const thresholdMs = thresholdMin * MIN;
  const cadenceMs = cadenceMin * MIN;

  // --- R3: candidate gaps (silent stretches) --------------------------------------------------
  const candidates = [];
  let status = 'ok';
  if (inWin.length === 0) {
    if (loggerAliveInWindow) {
      status = 'down';
      candidates.push({ startMs: win.startMs, endMs: win.endMs, edge: false });
    } else {
      return emptyResult(dateKey, 'no_data', {
        windowStartMs: win.startMs, windowEndMs: win.endMs, windowMinutes: win.minutes,
        pointCount: allTs.length, alarmsKnown, loggerKnown
      });
    }
  } else {
    if (inWin[0] - win.startMs > thresholdMs) candidates.push({ startMs: win.startMs, endMs: inWin[0], edge: true });
    for (let i = 1; i < inWin.length; i++) {
      if (inWin[i] - inWin[i - 1] > thresholdMs) {
        const startMs = inWin[i - 1] + cadenceMs; // the next sample was due one cadence later
        if (startMs < inWin[i]) candidates.push({ startMs, endMs: inWin[i], edge: false });
      }
    }
    const last = inWin[inWin.length - 1];
    if (win.endMs - last > thresholdMs) {
      const startMs = last + cadenceMs;
      if (startMs < win.endMs) candidates.push({ startMs, endMs: win.endMs, edge: true });
    }
  }

  // --- Trips from alarms (authoritative for grid trips and faults) ---------------------------
  const nowMs = now === null || now === undefined ? win.endMs : now;
  const tripIntervals = [];
  const commsIntervals = [];
  if (alarmsKnown) {
    for (const a of alarms) {
      const rawEnd = a.endMs ?? Math.min(nowMs, win.endMs);
      const startMs = Math.max(a.beginMs, win.startMs);
      const endMs = Math.min(rawEnd, win.endMs);
      if (endMs - startMs <= EPS_MS) continue;
      // Comms alarms are evidence about the logger, not downtime: keep them out of the trips.
      if (isCommsAlarmCode(a.code)) commsIntervals.push({ startMs, endMs });
      else tripIntervals.push({ startMs, endMs, codes: [String(a.code)], open: !!a.open });
    }
  }
  const trips = mergeIntervals(tripIntervals);

  // --- Classify -------------------------------------------------------------------------------
  const segments = trips.map((t) => ({
    kind: 'trip',
    startMs: t.startMs,
    endMs: t.endMs,
    minutes: (t.endMs - t.startMs) / MIN,
    cause: causeForAlarmCode(t.codes[0]),
    alarmCode: t.codes[0],
    alarmCodes: [...new Set(t.codes)],
    open: t.open
  }));

  for (const c of candidates) {
    for (const piece of subtract(c.startMs, c.endMs, trips)) {
      let kind;
      let loggerEvidence = null;
      if (c.edge) {
        kind = 'edge_gap';
      } else if (commsIntervals.some((ci) => ci.startMs < piece.endMs && ci.endMs > piece.startMs)) {
        kind = 'comms_lost'; // the device itself reported the link down; no heartbeat check needed
      } else if (!loggerKnown) {
        kind = 'gap';
        loggerEvidence = false;
      } else if (loggerAliveInside(loggerTs, piece, cadenceMs)) {
        kind = 'gap';
        loggerEvidence = true;
      } else {
        kind = 'comms_lost';
      }
      const seg = { kind, startMs: piece.startMs, endMs: piece.endMs, minutes: (piece.endMs - piece.startMs) / MIN };
      if (loggerEvidence !== null) seg.loggerEvidence = loggerEvidence;
      segments.push(seg);
    }
  }
  segments.sort((a, b) => a.startMs - b.startMs);

  // --- R4: figures ----------------------------------------------------------------------------
  const minutes = { producing: 0, trip: 0, gap: 0, comms_lost: 0, edge_gap: 0 };
  for (const s of segments) minutes[s.kind] += s.minutes;
  minutes.producing = Math.max(0, win.minutes - minutes.trip - minutes.gap - minutes.comms_lost - minutes.edge_gap);

  const known = win.minutes - minutes.comms_lost - minutes.edge_gap;
  const down = minutes.trip + minutes.gap;
  const uptimePct = known > 0 ? Math.min(100, Math.max(0, ((known - down) / known) * 100)) : null;

  return {
    dateKey, status, uptimePct,
    windowStartMs: win.startMs, windowEndMs: win.endMs, windowMinutes: win.minutes,
    pointCount: allTs.length, cadenceMin, resolutionMin: thresholdMin, lowConfidence,
    alarmsKnown, loggerKnown,
    minutes,
    tripCount: segments.filter((s) => s.kind === 'trip').length,
    gapCount: segments.filter((s) => s.kind === 'gap').length,
    commsLostCount: segments.filter((s) => s.kind === 'comms_lost').length,
    segments
  };
}

/**
 * R5: range aggregation. Weights each day by its known minutes (never a mean of percentages) and
 * excludes days whose uptime is not knowable.
 */
export function aggregateUptime(days) {
  let knownMinutes = 0;
  let downMinutes = 0;
  let tripCount = 0;
  let gapCount = 0;
  let daysCounted = 0;
  let daysNoData = 0;
  for (const d of days ?? []) {
    if (d.uptimePct === null || d.uptimePct === undefined) {
      daysNoData++;
      continue;
    }
    const known = d.windowMinutes - d.minutes.comms_lost - d.minutes.edge_gap;
    knownMinutes += known;
    downMinutes += d.minutes.trip + d.minutes.gap;
    tripCount += d.tripCount;
    gapCount += d.gapCount;
    daysCounted++;
  }
  return {
    uptimePct: knownMinutes > 0 ? ((knownMinutes - downMinutes) / knownMinutes) * 100 : null,
    knownMinutes, downMinutes, tripCount, gapCount, daysCounted, daysNoData
  };
}
