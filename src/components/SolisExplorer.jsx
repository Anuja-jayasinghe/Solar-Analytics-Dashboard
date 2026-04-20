import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { formatDateDDMMYYYY } from '../lib/dateFormatter';

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

const DATA_SOURCES = [
  { key: 'live', label: 'Live Telemetry', refreshKey: 'live' },
  { key: 'charts', label: 'Chart Aggregates', refreshKey: 'charts' },
  { key: 'totalEarnings', label: 'Earnings Ledger', refreshKey: 'totalEarnings' },
  { key: 'monthlyGen', label: 'Monthly Summary', refreshKey: 'monthlyGen' },
];

function formatLag(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'N/A';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)} s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

function formatTimestamp(ts) {
  return formatDateDDMMYYYY(ts, 'Never');
}

function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 'N/A';
  if (n < 1000) return `${n} ms`;
  if (n < 60000) return `${Math.round(n / 1000)} s`;
  if (n < 3600000) return `${Math.round(n / 60000)} min`;
  return `${(n / 3600000).toFixed(1)} h`;
}

function statusFromSource(source, now) {
  if (source.loading) {
    return { code: 'loading', label: 'Loading', tone: 'info' };
  }
  if (source.error) {
    return { code: 'error', label: 'Failed', tone: 'error' };
  }
  if (!source.lastUpdate) {
    return { code: 'unknown', label: 'No Data', tone: 'warning' };
  }

  const lag = now - source.lastUpdate;
  if (lag > STALE_THRESHOLD_MS) {
    return { code: 'stale', label: 'Stale', tone: 'warning' };
  }

  return { code: 'healthy', label: 'Healthy', tone: 'success' };
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function deriveAlarmTimestamp(alarm) {
  const raw =
    alarm.alarmBeginTime ||
    alarm.alarmEndTime ||
    alarm.alarmTime ||
    alarm.createTime ||
    alarm.time ||
    alarm.dataTimestamp ||
    alarm.occurTime;
  if (!raw) return 0;
  if (typeof raw === 'number') {
    return raw > 1e12 ? raw : raw * 1000;
  }
  if (/^\d+$/.test(String(raw))) {
    const numeric = Number(raw);
    return numeric > 1e12 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveAlarmName(alarm) {
  return (
    alarm.alarmName ||
    alarm.alarmMsg ||
    alarm.msg ||
    alarm.message ||
    (alarm.alarmCode ? `Alarm ${alarm.alarmCode}` : 'Alarm')
  );
}

function resolveAlarmState(state) {
  const map = {
    '0': 'Pending',
    '1': 'Processed',
    '2': 'Resolved',
  };
  return map[String(state)] || String(state ?? '-');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatClockHHMM(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function buildUptimeForDay(dayIso, points) {
  const rows = toArray(points)
    .map((point) => {
      const rawTs = point.dataTimestamp || point.time || point.date;
      let ts;
      if (typeof rawTs === 'number') {
        ts = rawTs > 1e12 ? rawTs : rawTs * 1000;
      } else if (/^\d+$/.test(String(rawTs || ''))) {
        const numeric = Number(rawTs);
        ts = numeric > 1e12 ? numeric : numeric * 1000;
      } else if (typeof point.time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(point.time)) {
        ts = Date.parse(`${dayIso}T${point.time}`);
      } else {
        ts = Date.parse(rawTs);
      }
      const power = toNumber(point.power ?? point.pac ?? point.value) ?? 0;
      return Number.isFinite(ts) ? { ts, power } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  if (!rows.length) {
    return {
      date: dayIso,
      points: 0,
      uptimePct: 0,
      state: 'off',
      firstSeen: null,
      lastSeen: null,
      periodLabel: '--:-- - --:--',
    };
  }

  const firstSeen = rows[0].ts;
  const lastSeen = rows[rows.length - 1].ts;
  const intervals = [];
  for (let i = 1; i < rows.length; i += 1) {
    const delta = rows[i].ts - rows[i - 1].ts;
    if (delta > 0 && delta < 30 * 60 * 1000) {
      intervals.push(delta);
    }
  }

  const sampleInterval = median(intervals) || 5 * 60 * 1000;
  const windowMs = Math.max(0, lastSeen - firstSeen);
  const expectedPoints = Math.max(1, Math.round(windowMs / sampleInterval) + 1);
  const uptimePct = Math.max(0, Math.min(100, Math.round((rows.length / expectedPoints) * 100)));

  let state = 'on';
  if (uptimePct < 80) state = 'mostly-off';
  else if (uptimePct < 95) state = 'intermittent';

  return {
    date: dayIso,
    points: rows.length,
    uptimePct,
    state,
    firstSeen,
    lastSeen,
    periodLabel: `${formatClockHHMM(firstSeen)} - ${formatClockHHMM(lastSeen)}`,
  };
}

export default function SolisExplorer({ open, onClose }) {
  const panelRef = useRef(null);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [expandedLedgerKey, setExpandedLedgerKey] = useState(null);
  const [inverterLoading, setInverterLoading] = useState(false);
  const [inverterError, setInverterError] = useState(null);
  const [inverterData, setInverterData] = useState({
    inverter: null,
    detail: null,
    alarms: [],
    daySeries: [],
    uptimeSeries: [],
    updatedAt: null,
  });

  const {
    loading,
    errors,
    lastUpdate,
    isStale,
    refreshData,
    refreshAll,
  } = useData();

  const now = Date.now();

  const sourceRows = useMemo(() => {
    return DATA_SOURCES.map((src) => {
      const source = {
        ...src,
        loading: Boolean(loading?.[src.refreshKey]),
        error: errors?.[src.refreshKey] || null,
        lastUpdate: lastUpdate?.[src.refreshKey] || null,
      };

      const status = statusFromSource(source, now);
      const lagMs = source.lastUpdate ? now - source.lastUpdate : Number.NaN;

      return {
        ...source,
        status,
        lagMs,
      };
    });
  }, [errors, lastUpdate, loading, now]);

  const metrics = useMemo(() => {
    const total = sourceRows.length;
    const healthy = sourceRows.filter((s) => s.status.code === 'healthy').length;
    const activeIncidents = sourceRows.filter((s) => s.status.code === 'error').length;

    const withTimestamps = sourceRows.filter((s) => Number.isFinite(s.lagMs));
    const fresh = withTimestamps.filter((s) => s.lagMs <= STALE_THRESHOLD_MS).length;

    const freshnessPct = withTimestamps.length
      ? Math.round((fresh / withTimestamps.length) * 100)
      : 0;

    const availabilityPct = total ? Math.round((healthy / total) * 100) : 0;

    const avgLag = withTimestamps.length
      ? Math.round(withTimestamps.reduce((sum, s) => sum + s.lagMs, 0) / withTimestamps.length)
      : Number.NaN;

    const maxLag = withTimestamps.length
      ? Math.max(...withTimestamps.map((s) => s.lagMs))
      : Number.NaN;

    return {
      availabilityPct,
      freshnessPct,
      activeIncidents,
      avgLag,
      maxLag,
    };
  }, [sourceRows]);

  const incidents = useMemo(() => {
    const rows = [];

    sourceRows.forEach((src) => {
      if (src.error) {
        rows.push({
          type: 'error',
          source: src.label,
          message: src.error.message || String(src.error),
          time: src.error.time || src.lastUpdate || Date.now(),
        });
      } else if (src.status.code === 'stale') {
        rows.push({
          type: 'stale',
          source: src.label,
          message: `No fresh data for ${formatLag(src.lagMs)}`,
          time: src.lastUpdate || Date.now(),
        });
      }
    });

    return rows
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 8);
  }, [sourceRows]);

  const runExplore = useCallback(async (endpointKey, params) => {
    const response = await fetch('/api/solis/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointKey, params }),
    });

    const body = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`Non-JSON response from ${endpointKey}`);
    }

    if (!response.ok || !parsed?.ok) {
      const parts = [parsed?.error || `Request failed (${response.status})`];
      if (parsed?.message) parts.push(parsed.message);
      if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
        parts.push(parsed.details.join(', '));
      }
      throw new Error(parts.join(' | '));
    }

    return parsed.solisResponse;
  }, []);

  const fetchInverterInsights = useCallback(async () => {
    setInverterLoading(true);
    setInverterError(null);

    try {
      const inverterList = await runExplore('inverterList', { pageNo: '1', pageSize: '20' });
      const records =
        toArray(inverterList?.data?.page?.records).length > 0
          ? toArray(inverterList?.data?.page?.records)
          : toArray(inverterList?.data);

      const inverter = records[0];
      if (!inverter) {
        throw new Error('No inverter found for the account.');
      }

      const inverterId = inverter.id || inverter.inverterId || inverter.deviceId || '';
      const inverterSn = inverter.sn || inverter.inverterSn || inverter.deviceSn || '';
      const stationId = inverter.stationId || inverter.powerStationId || '';

      const today = new Date().toISOString().slice(0, 10);

      const recentDates = Array.from({ length: 7 }, (_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - idx);
        return d.toISOString().slice(0, 10);
      });

      const detailPromise = runExplore('inverterDetail', {
        ...(inverterId ? { id: String(inverterId) } : {}),
        ...(inverterSn ? { sn: String(inverterSn) } : {}),
      }).catch(() => null);

      const dayPromise = runExplore('inverterDay', {
        ...(inverterSn ? { sn: String(inverterSn) } : {}),
        ...(inverterId && !inverterSn ? { id: String(inverterId) } : {}),
        time: today,
        timeZone: '8',
      }).catch(() => null);

      const alarmsPromise = runExplore('alarmList', {
        pageNo: '1',
        pageSize: '30',
        ...(stationId ? { stationId: String(stationId) } : {}),
      }).catch(() => null);

      const uptimePromises = recentDates.map((date) =>
        runExplore('inverterDay', {
          ...(inverterSn ? { sn: String(inverterSn) } : {}),
          ...(inverterId && !inverterSn ? { id: String(inverterId) } : {}),
          time: date,
          timeZone: '8',
        }).catch(() => null)
      );

      const [detailResp, dayResp, alarmsResp] = await Promise.all([
        detailPromise,
        dayPromise,
        alarmsPromise,
      ]);

      const uptimeResponses = await Promise.all(uptimePromises);

      const alarms = toArray(alarmsResp?.data?.page?.records).length > 0
        ? toArray(alarmsResp?.data?.page?.records)
        : toArray(alarmsResp?.data?.records);

      const daySeries = toArray(dayResp?.data);
      const uptimeSeries = recentDates
        .map((date, idx) => buildUptimeForDay(date, uptimeResponses[idx]?.data))
        .sort((a, b) => a.date.localeCompare(b.date));

      setInverterData({
        inverter,
        detail: detailResp?.data || null,
        alarms,
        daySeries,
        uptimeSeries,
        updatedAt: Date.now(),
      });
    } catch (error) {
      setInverterError(error.message || 'Failed to load inverter diagnostics');
      setInverterData((prev) => ({ ...prev, updatedAt: Date.now() }));
    } finally {
      setInverterLoading(false);
    }
  }, [runExplore]);

  useEffect(() => {
    if (!open || activeTab !== 'inverter') return;

    if (!inverterData.updatedAt) {
      fetchInverterInsights();
      return;
    }

    const age = Date.now() - inverterData.updatedAt;
    if (age > 5 * 60 * 1000) {
      fetchInverterInsights();
    }
  }, [activeTab, fetchInverterInsights, inverterData.updatedAt, open]);

  const inverterMetrics = useMemo(() => {
    const detail = inverterData.detail || {};
    const unresolvedAlarms = inverterData.alarms.filter((a) => String(a.state) !== '2').length;

    const realtimePower =
      toNumber(detail.pac) ??
      toNumber(detail.power) ??
      toNumber(inverterData.inverter?.pac) ??
      null;

    const todayEnergy =
      toNumber(detail.eToday) ??
      toNumber(detail.dayEnergy) ??
      null;

    const statusRaw = detail.state ?? detail.status ?? inverterData.inverter?.state;
    const statusCode = Number(statusRaw);

    let score = 100;
    if (statusCode === 2) score -= 30;
    if (statusCode === 3) score -= 40;
    score -= Math.min(unresolvedAlarms * 8, 32);
    score -= metrics.activeIncidents * 5;
    if (isStale) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const healthClass = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';

    return {
      score,
      healthClass,
      unresolvedAlarms,
      realtimePower,
      todayEnergy,
      statusCode,
    };
  }, [inverterData, isStale, metrics.activeIncidents]);

  const alarmTimeline = useMemo(() => {
    return inverterData.alarms
      .map((alarm) => ({
        type: 'alarm',
        title: resolveAlarmName(alarm),
        severity: Number(alarm.alarmLevel || 1),
        status: String(alarm.state || ''),
        source: alarm.alarmDeviceSn || alarm.deviceSn || 'Inverter',
        time: deriveAlarmTimestamp(alarm),
      }))
      .filter((row) => row.time > 0)
      .sort((a, b) => b.time - a.time)
      .slice(0, 30);
  }, [inverterData.alarms]);

  const alarmLedger = useMemo(() => {
    const bucket = new Map();

    inverterData.alarms.forEach((alarm) => {
      const code = String(alarm.alarmCode || '-');
      const name = resolveAlarmName(alarm);
      const key = `${code}__${name}`;
      const ts = deriveAlarmTimestamp(alarm);
      const level = Number(alarm.alarmLevel || 1);
      const isOpen = String(alarm.state) !== '2';

      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          code,
          name,
          level,
          totalCount: 0,
          openCount: 0,
          lastSeen: 0,
          latestState: '-',
          sample: null,
        });
      }

      const row = bucket.get(key);
      row.totalCount += 1;
      row.openCount += isOpen ? 1 : 0;
      row.lastSeen = Math.max(row.lastSeen, ts);
      row.level = Math.max(row.level, level);

      if (!row.sample || ts >= deriveAlarmTimestamp(row.sample)) {
        row.sample = alarm;
        row.latestState = resolveAlarmState(alarm.state);
      }
    });

    return Array.from(bucket.values())
      .sort((a, b) => {
        if (b.openCount !== a.openCount) return b.openCount - a.openCount;
        if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen;
        return b.totalCount - a.totalCount;
      })
      .slice(0, 12);
  }, [inverterData.alarms]);

  const performanceTimeline = useMemo(() => {
    const entries = inverterData.daySeries
      .map((point) => {
        const tsRaw = point.dataTimestamp || point.time || point.date;
        const parsed = Date.parse(tsRaw);
        if (!Number.isFinite(parsed)) return null;

        const power = toNumber(point.power ?? point.pac ?? point.value);
        return {
          time: parsed,
          power,
          raw: point,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time);

    if (!entries.length) return [];

    const latest = entries[0];
    const maxPoint = entries.reduce((best, current) => ((current.power ?? -1) > (best.power ?? -1) ? current : best), entries[0]);
    const lowPoint = entries.reduce((best, current) => ((current.power ?? Infinity) < (best.power ?? Infinity) ? current : best), entries[0]);

    return [
      {
        type: 'performance',
        title: `Latest power sample: ${latest.power ?? 'N/A'} kW`,
        detail: 'Current telemetry point from inverterDay',
        time: latest.time,
      },
      {
        type: 'performance',
        title: `Peak output today: ${maxPoint.power ?? 'N/A'} kW`,
        detail: 'Highest power point in intraday curve',
        time: maxPoint.time,
      },
      {
        type: 'performance',
        title: `Lowest output sample: ${lowPoint.power ?? 'N/A'} kW`,
        detail: 'Lowest power point in intraday curve',
        time: lowPoint.time,
      },
    ].sort((a, b) => b.time - a.time);
  }, [inverterData.daySeries]);

  const uptimeMetrics = useMemo(() => {
    const days = inverterData.uptimeSeries || [];
    if (!days.length) {
      return {
        avgUptime: 0,
        offDays: 0,
        intermittentDays: 0,
      };
    }

    const avgUptime = Math.round(days.reduce((sum, d) => sum + (d.uptimePct || 0), 0) / days.length);
    const offDays = days.filter((d) => d.state === 'off').length;
    const intermittentDays = days.filter((d) => d.state === 'intermittent' || d.state === 'mostly-off').length;

    return {
      avgUptime,
      offDays,
      intermittentDays,
    };
  }, [inverterData.uptimeSeries]);

  const hasInverterInfo = Boolean(inverterData.inverter || inverterData.detail);
  const hasAlarmData = inverterData.alarms.length > 0;
  const hasPerformanceData = performanceTimeline.length > 0;
  const hasUptimeData = inverterData.uptimeSeries.length > 0;
  const hasAnyInverterContent = hasInverterInfo || hasAlarmData || hasPerformanceData || hasUptimeData;
  const showInverterSkeleton = inverterLoading && !hasAnyInverterContent;

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="pipeline-panel">
      <style>{`
        .pipeline-panel {
          position: fixed;
          bottom: 20px;
          left: 80px;
          width: min(1040px, calc(100vw - 110px));
          max-height: 85vh;
          background: rgba(20, 20, 25, 0.9);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          overflow: hidden;
          color: var(--text-color);
        }

        .pipeline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(90deg, rgba(255, 122, 0, 0.18), rgba(0, 194, 168, 0.08));
        }

        .pipeline-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pipeline-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pipeline-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .pipeline-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .pipeline-close {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          border-radius: 8px;
          width: 30px;
          height: 30px;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }

        .tab-btn {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 600;
        }

        .tab-btn.active {
          color: var(--accent);
          border-color: rgba(255, 122, 0, 0.45);
          background: rgba(255, 122, 0, 0.12);
        }

        .pipeline-body {
          padding: 14px 16px 28px;
          overflow: auto;
          display: grid;
          gap: 14px;
          scroll-padding-bottom: 28px;
          scrollbar-gutter: stable both-edges;
        }

        .inverter-body {
          min-height: 540px;
        }

        .pipeline-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(120px, 1fr));
          gap: 10px;
        }

        .metric-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 10px;
        }

        .metric-card.metric-card-skeleton {
          border-color: rgba(255, 122, 0, 0.18);
          background: linear-gradient(180deg, rgba(255, 122, 0, 0.08), rgba(255, 255, 255, 0.02));
        }

        .skeleton-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(154, 209, 255, 0.3);
          color: #9ad1ff;
          font-size: 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 6px;
        }

        .signal-bars {
          margin-top: 10px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 24px;
        }

        .signal-bars span {
          width: 5px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 122, 0, 0.75), rgba(255, 122, 0, 0.2));
          animation: signalDrift 1.15s ease-in-out infinite;
        }

        .signal-bars span:nth-child(2) { animation-delay: 0.12s; }
        .signal-bars span:nth-child(3) { animation-delay: 0.24s; }
        .signal-bars span:nth-child(4) { animation-delay: 0.36s; }

        @keyframes signalDrift {
          0%,
          100% {
            opacity: 0.5;
            transform: scaleY(0.9);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.08);
          }
        }

        .metric-label {
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value {
          margin-top: 4px;
          font-size: 20px;
          font-weight: 700;
          color: var(--accent);
        }

        .pipeline-grid {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 12px;
        }

        .panel-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-card h4 {
          margin: 0;
          padding: 10px 12px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .table th,
        .table td {
          text-align: left;
          padding: 9px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          vertical-align: top;
        }

        .table th {
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .ledger-row {
          cursor: pointer;
        }

        .ledger-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .ledger-row.is-open {
          background: rgba(255, 122, 0, 0.08);
        }

        .ledger-detail-cell {
          padding: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ledger-details {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          display: grid;
          grid-template-columns: repeat(2, minmax(180px, 1fr));
          gap: 8px 14px;
          font-size: 11px;
        }

        .ledger-meta {
          color: var(--text-secondary);
        }

        .ledger-meta strong {
          color: var(--text-color);
          font-weight: 600;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 2px 8px;
          border: 1px solid transparent;
        }

        .status::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-success {
          color: #43d48f;
          border-color: rgba(67, 212, 143, 0.35);
          background: rgba(67, 212, 143, 0.12);
        }
        .status-success::before { background: #43d48f; }

        .status-warning {
          color: #ffd166;
          border-color: rgba(255, 209, 102, 0.35);
          background: rgba(255, 209, 102, 0.12);
        }
        .status-warning::before { background: #ffd166; }

        .status-error {
          color: #ff6b6b;
          border-color: rgba(255, 107, 107, 0.35);
          background: rgba(255, 107, 107, 0.12);
        }
        .status-error::before { background: #ff6b6b; }

        .status-info {
          color: #9ad1ff;
          border-color: rgba(154, 209, 255, 0.35);
          background: rgba(154, 209, 255, 0.12);
        }
        .status-info::before { background: #9ad1ff; }

        .actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 12px 0 6px;
          margin-bottom: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-color);
          border-radius: 9px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .btn-primary {
          border-color: rgba(255, 122, 0, 0.55);
          background: rgba(255, 122, 0, 0.18);
          color: #ffb273;
        }

        .incident-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .incident-item {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .incident-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .incident-source { color: var(--text-color); font-weight: 600; }
        .incident-time { color: var(--text-secondary); font-size: 11px; }

        .incident-msg {
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.4;
          word-break: break-word;
        }

        .health-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(140px, 1fr));
          gap: 10px;
        }

        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 260px;
          overflow: auto;
        }

        .timeline-item {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: grid;
          gap: 3px;
        }

        .timeline-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-color);
        }

        .timeline-detail {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .uptime-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 10px 12px 12px;
        }

        .uptime-row {
          display: grid;
          grid-template-columns: 84px 1fr 56px;
          align-items: center;
          gap: 10px;
          font-size: 11px;
        }

        .uptime-date {
          color: var(--text-secondary);
        }

        .uptime-track {
          position: relative;
          height: 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .uptime-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 999px;
        }

        .uptime-fill.state-on { background: linear-gradient(90deg, #3ddc84, #83f28f); }
        .uptime-fill.state-intermittent { background: linear-gradient(90deg, #ffd166, #ffb347); }
        .uptime-fill.state-mostly-off,
        .uptime-fill.state-off { background: linear-gradient(90deg, #ff6b6b, #ff8e8e); }

        .uptime-pct {
          text-align: right;
          color: var(--text-color);
          font-weight: 700;
        }

        .uptime-meta {
          margin-left: 94px;
          font-size: 10px;
          color: var(--text-secondary);
          margin-top: -8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .uptime-summary {
          display: flex;
          gap: 8px;
          padding: 0 12px 8px;
          flex-wrap: wrap;
        }

        .uptime-chip {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 10px;
          letter-spacing: 0.2px;
        }

        .uptime-period-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .uptime-period-item {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 10px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .uptime-period-item strong {
          color: var(--text-color);
          font-weight: 600;
        }

        .empty {
          padding: 16px 12px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        .skeleton-line {
          height: 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.06) 25%,
            rgba(255, 255, 255, 0.13) 37%,
            rgba(255, 255, 255, 0.06) 63%
          );
          background-size: 400% 100%;
          animation: skeletonPulse 1.35s ease-in-out infinite;
        }

        .skeleton-line:last-child {
          margin-bottom: 0;
        }

        .skeleton-content {
          padding: 12px;
        }

        @keyframes skeletonPulse {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: 0 0;
          }
        }

        @media (max-width: 980px) {
          .pipeline-panel {
            left: 10px;
            width: calc(100vw - 20px);
            bottom: 10px;
            max-height: calc(100vh - 20px);
          }

          .pipeline-metrics,
          .health-grid {
            grid-template-columns: repeat(2, minmax(130px, 1fr));
          }

          .pipeline-grid,
          .split-grid {
            grid-template-columns: 1fr;
          }

          .pipeline-body {
            padding-bottom: 22px;
            scroll-padding-bottom: 22px;
          }

          .pipeline-header {
            align-items: flex-start;
          }

          .pipeline-header-right {
            flex-direction: column;
            align-items: flex-end;
          }
        }
      `}</style>

      <div className="pipeline-header">
        <div>
          <div className="pipeline-title">Operations & Inverter Diagnostics</div>
          <div className="pipeline-subtitle">Pipeline SLOs, alarm intelligence, and inverter health timeline</div>
        </div>
        <div className="pipeline-header-right">
          <div className="pipeline-header-actions">
            <span className={`status status-${isStale ? 'warning' : 'success'}`}>
              {isStale ? 'Global stale state detected' : 'Global data freshness healthy'}
            </span>
            <button className="btn btn-primary" onClick={() => refreshAll()}>
              Refresh All Pipelines
            </button>
          </div>
          <button className="pipeline-close" onClick={onClose} aria-label="Close panel">x</button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          Data Pipeline Health
        </button>
        <button
          className={`tab-btn ${activeTab === 'inverter' ? 'active' : ''}`}
          onClick={() => setActiveTab('inverter')}
        >
          Inverter Health & Alarms
        </button>
      </div>

      {activeTab === 'pipeline' && (
        <div className="pipeline-body">
          <div className="pipeline-metrics">
            <div className="metric-card">
              <div className="metric-label">Availability</div>
              <div className="metric-value">{metrics.availabilityPct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Freshness SLA</div>
              <div className="metric-value">{metrics.freshnessPct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Active Incidents</div>
              <div className="metric-value">{metrics.activeIncidents}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg Lag</div>
              <div className="metric-value">{formatLag(metrics.avgLag)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Worst Lag</div>
              <div className="metric-value">{formatLag(metrics.maxLag)}</div>
            </div>
          </div>

          <div className="pipeline-grid">
            <div className="panel-card">
              <h4>Source Status Matrix</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Lag</th>
                    <th>Last Update</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((src) => (
                    <tr key={src.key}>
                      <td>{src.label}</td>
                      <td>
                        <span className={`status status-${src.status.tone}`}>{src.status.label}</span>
                      </td>
                      <td>{formatLag(src.lagMs)}</td>
                      <td>{formatTimestamp(src.lastUpdate)}</td>
                      <td>
                        <button
                          className="btn"
                          onClick={() => refreshData(src.refreshKey)}
                          disabled={Boolean(src.loading)}
                        >
                          {src.loading ? 'Refreshing' : 'Refresh'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel-card">
              <h4>Incident Feed</h4>
              {incidents.length === 0 ? (
                <div className="empty">No active incidents. Pipeline appears stable.</div>
              ) : (
                <ul className="incident-list">
                  {incidents.map((incident, idx) => (
                    <li key={`${incident.source}-${idx}`} className="incident-item">
                      <div className="incident-head">
                        <span className="incident-source">{incident.source}</span>
                        <span className="incident-time">{formatTimestamp(incident.time)}</span>
                      </div>
                      <div className="incident-msg">{incident.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'inverter' && (
        <div className="pipeline-body inverter-body">
          <div className="health-grid">
            {showInverterSkeleton ? (
              <>
                <div className="metric-card metric-card-skeleton">
                  <div className="metric-label">Health Score</div>
                  <div className="skeleton-badge">Signal Locking</div>
                  <div className="signal-bars"><span style={{ height: 9 }} /><span style={{ height: 14 }} /><span style={{ height: 18 }} /><span style={{ height: 23 }} /></div>
                </div>
                <div className="metric-card metric-card-skeleton">
                  <div className="metric-label">Realtime Power</div>
                  <div className="skeleton-badge">Reading Bus</div>
                  <div className="signal-bars"><span style={{ height: 8 }} /><span style={{ height: 13 }} /><span style={{ height: 16 }} /><span style={{ height: 21 }} /></div>
                </div>
                <div className="metric-card metric-card-skeleton">
                  <div className="metric-label">Today Energy</div>
                  <div className="skeleton-badge">Aggregating</div>
                  <div className="signal-bars"><span style={{ height: 10 }} /><span style={{ height: 12 }} /><span style={{ height: 17 }} /><span style={{ height: 22 }} /></div>
                </div>
                <div className="metric-card metric-card-skeleton">
                  <div className="metric-label">Unresolved Alarms</div>
                  <div className="skeleton-badge">Syncing Events</div>
                  <div className="signal-bars"><span style={{ height: 7 }} /><span style={{ height: 11 }} /><span style={{ height: 15 }} /><span style={{ height: 19 }} /></div>
                </div>
              </>
            ) : (
              <>
                <div className="metric-card">
                  <div className="metric-label">Health Score</div>
                  <div className="metric-value">{inverterMetrics.score}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Realtime Power</div>
                  <div className="metric-value">
                    {inverterMetrics.realtimePower !== null ? `${inverterMetrics.realtimePower} kW` : 'N/A'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Today Energy</div>
                  <div className="metric-value">
                    {inverterMetrics.todayEnergy !== null ? `${inverterMetrics.todayEnergy} kWh` : 'N/A'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Unresolved Alarms</div>
                  <div className="metric-value">{inverterMetrics.unresolvedAlarms}</div>
                </div>
              </>
            )}
          </div>

          {!showInverterSkeleton && (
            <div className="panel-card">
              <h4>Inverter Uptime Graph (Last 7 Days)</h4>
              {hasUptimeData ? (
                <>
                  <div className="uptime-summary">
                    <span className="uptime-chip">Fully Off Days: {uptimeMetrics.offDays}</span>
                    <span className="uptime-chip">Intermittent Days: {uptimeMetrics.intermittentDays}</span>
                  </div>
                  <div className="uptime-grid">
                    {inverterData.uptimeSeries.map((day) => (
                      <React.Fragment key={`uptime-${day.date}`}>
                        <div className="uptime-row">
                          <div className="uptime-date">{formatTimestamp(day.date)}</div>
                          <div className="uptime-track">
                            <div
                              className={`uptime-fill state-${day.state}`}
                              style={{ width: `${day.uptimePct}%` }}
                            />
                          </div>
                          <div className="uptime-pct">{day.uptimePct}%</div>
                        </div>
                        <div className="uptime-meta">
                          Window {day.periodLabel} | {day.points} pts | State {day.state}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="empty" style={{ paddingTop: 8 }}>
                    Derived from inverterDay sample coverage and observed active window.
                  </div>
                </>
              ) : (
                <div className="empty">Uptime data not available yet. Click Refresh Inverter Health.</div>
              )}
            </div>
          )}

          {(!hasInverterInfo && !hasAlarmData && !hasPerformanceData && !hasUptimeData && !inverterLoading && !inverterError) ? (
            <div className="panel-card">
              <h4>Inverter Diagnostics</h4>
              <div className="empty">No inverter diagnostics data returned yet. Click refresh to retry.</div>
            </div>
          ) : (
            <>
              {showInverterSkeleton && (
                <>
                  <div className="split-grid">
                    <div className="panel-card">
                      <h4>Inverter Info</h4>
                      <div className="skeleton-content">
                        <div className="skeleton-line" style={{ width: '78%' }} />
                        <div className="skeleton-line" style={{ width: '64%' }} />
                        <div className="skeleton-line" style={{ width: '70%' }} />
                        <div className="skeleton-line" style={{ width: '56%' }} />
                      </div>
                    </div>
                    <div className="panel-card">
                      <h4>Alarm Timeline</h4>
                      <div className="skeleton-content">
                        <div className="skeleton-line" style={{ width: '84%' }} />
                        <div className="skeleton-line" style={{ width: '72%' }} />
                        <div className="skeleton-line" style={{ width: '66%' }} />
                        <div className="skeleton-line" style={{ width: '74%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="split-grid">
                    <div className="panel-card">
                      <h4>Performance Timeline</h4>
                      <div className="skeleton-content">
                        <div className="skeleton-line" style={{ width: '80%' }} />
                        <div className="skeleton-line" style={{ width: '62%' }} />
                        <div className="skeleton-line" style={{ width: '76%' }} />
                      </div>
                    </div>
                    <div className="panel-card">
                      <h4>Alarm Ledger</h4>
                      <div className="skeleton-content">
                        <div className="skeleton-line" style={{ width: '92%' }} />
                        <div className="skeleton-line" style={{ width: '88%' }} />
                        <div className="skeleton-line" style={{ width: '85%' }} />
                        <div className="skeleton-line" style={{ width: '90%' }} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {(hasInverterInfo || alarmTimeline.length > 0) && (
                <div className="split-grid">
                  {hasInverterInfo && (
                    <div className="panel-card">
                      <h4>Inverter Info</h4>
                      <table className="table">
                        <tbody>
                          <tr>
                            <th>Inverter ID</th>
                            <td>{inverterData.inverter?.id || inverterData.detail?.id || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>Serial Number</th>
                            <td>{inverterData.inverter?.sn || inverterData.detail?.sn || 'N/A'}</td>
                          </tr>
                          <tr>
                            <th>State</th>
                            <td>
                              <span className={`status status-${inverterMetrics.healthClass}`}>
                                {inverterMetrics.statusCode === 1 ? 'Online' : inverterMetrics.statusCode === 2 ? 'Offline' : inverterMetrics.statusCode === 3 ? 'Alarm' : 'Unknown'}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <th>Last Diagnostics Update</th>
                            <td>{formatTimestamp(inverterData.updatedAt)}</td>
                          </tr>
                          <tr>
                            <th>Data Points (today)</th>
                            <td>{inverterData.daySeries.length}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {alarmTimeline.length > 0 && (
                    <div className="panel-card">
                      <h4>Alarm Timeline</h4>
                      <ul className="timeline">
                        {alarmTimeline.map((event, idx) => (
                          <li className="timeline-item" key={`alarm-${idx}`}>
                            <div className="timeline-title">{event.title}</div>
                            <div className="timeline-detail">
                              Severity {event.severity} | State {resolveAlarmState(event.status)} | {event.source}
                            </div>
                            <div className="incident-time">{formatTimestamp(event.time)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {(hasPerformanceData || alarmLedger.length > 0) && (
                <div className="split-grid">
                  {hasPerformanceData && (
                    <div className="panel-card">
                      <h4>Performance Timeline</h4>
                      <ul className="timeline">
                        {performanceTimeline.map((event, idx) => (
                          <li className="timeline-item" key={`perf-${idx}`}>
                            <div className="timeline-title">{event.title}</div>
                            <div className="timeline-detail">{event.detail}</div>
                            <div className="incident-time">{formatTimestamp(event.time)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {alarmLedger.length > 0 && (
                    <div className="panel-card">
                      <h4>Alarm Ledger</h4>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Level</th>
                            <th>Total</th>
                            <th>Open</th>
                            <th>Last Seen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alarmLedger.map((alarm, idx) => (
                            <React.Fragment key={`ledger-${idx}`}>
                              <tr
                                className={`ledger-row ${expandedLedgerKey === alarm.key ? 'is-open' : ''}`}
                                onClick={() => setExpandedLedgerKey((prev) => (prev === alarm.key ? null : alarm.key))}
                              >
                                <td>{alarm.code}</td>
                                <td>{alarm.name}</td>
                                <td>{alarm.level ?? '-'}</td>
                                <td>{alarm.totalCount}</td>
                                <td>{alarm.openCount}</td>
                                <td>{alarm.lastSeen ? formatTimestamp(alarm.lastSeen) : 'N/A'}</td>
                              </tr>
                              {expandedLedgerKey === alarm.key && (
                                <tr>
                                  <td className="ledger-detail-cell" colSpan={6}>
                                    <div className="ledger-details">
                                      <div className="ledger-meta"><strong>Alarm message:</strong> {alarm.sample?.alarmMsg || 'Not provided by API'}</div>
                                      <div className="ledger-meta"><strong>Advice:</strong> {alarm.sample?.advice || 'Not provided by API'}</div>
                                      <div className="ledger-meta"><strong>Latest state:</strong> {alarm.latestState}</div>
                                      <div className="ledger-meta"><strong>Device SN:</strong> {alarm.sample?.alarmDeviceSn || 'N/A'}</div>
                                      <div className="ledger-meta"><strong>Machine:</strong> {alarm.sample?.machine || 'N/A'} ({alarm.sample?.model || 'N/A'})</div>
                                      <div className="ledger-meta"><strong>Station:</strong> {alarm.sample?.stationName || 'N/A'}</div>
                                      <div className="ledger-meta"><strong>Started:</strong> {formatTimestamp(deriveAlarmTimestamp({ alarmBeginTime: alarm.sample?.alarmBeginTime }))}</div>
                                      <div className="ledger-meta"><strong>Ended:</strong> {formatTimestamp(deriveAlarmTimestamp({ alarmEndTime: alarm.sample?.alarmEndTime }))}</div>
                                      <div className="ledger-meta"><strong>Duration:</strong> {formatDuration(alarm.sample?.alarmLong)}</div>
                                      <div className="ledger-meta"><strong>Code description:</strong> Not provided by current Solis API endpoints/datasheet</div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </>
          )}

          <div className="actions">
            {inverterError && (
              <span className="status status-error">{inverterError}</span>
            )}
            {!inverterError && inverterLoading && (
              <span className="status status-info">Loading inverter diagnostics...</span>
            )}
            {!inverterError && !inverterLoading && (
              <span className={`status status-${inverterMetrics.healthClass}`}>
                Inverter health telemetry updated
              </span>
            )}
            <button className="btn btn-primary" onClick={fetchInverterInsights} disabled={inverterLoading}>
              {inverterLoading ? 'Refreshing...' : 'Refresh Inverter Health'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
