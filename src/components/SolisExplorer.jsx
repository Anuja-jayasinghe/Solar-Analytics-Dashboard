import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';

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
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
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

export default function SolisExplorer({ open, onClose }) {
  const panelRef = useRef(null);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [inverterLoading, setInverterLoading] = useState(false);
  const [inverterError, setInverterError] = useState(null);
  const [inverterData, setInverterData] = useState({
    inverter: null,
    detail: null,
    alarms: [],
    daySeries: [],
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

      const [detailResp, dayResp, alarmsResp] = await Promise.all([
        detailPromise,
        dayPromise,
        alarmsPromise,
      ]);

      const alarms = toArray(alarmsResp?.data?.page?.records).length > 0
        ? toArray(alarmsResp?.data?.page?.records)
        : toArray(alarmsResp?.data?.records);

      const daySeries = toArray(dayResp?.data);

      setInverterData({
        inverter,
        detail: detailResp?.data || null,
        alarms,
        daySeries,
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

  const hasInverterInfo = Boolean(inverterData.inverter || inverterData.detail);
  const hasAlarmData = inverterData.alarms.length > 0;
  const hasPerformanceData = performanceTimeline.length > 0;

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
          padding: 14px 16px 16px;
          overflow: auto;
          display: grid;
          gap: 14px;
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
          padding: 10px 0 0;
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

        .empty {
          padding: 16px 12px;
          color: var(--text-secondary);
          font-size: 12px;
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
        }
      `}</style>

      <div className="pipeline-header">
        <div>
          <div className="pipeline-title">Operations & Inverter Diagnostics</div>
          <div className="pipeline-subtitle">Pipeline SLOs, alarm intelligence, and inverter health timeline</div>
        </div>
        <button className="pipeline-close" onClick={onClose} aria-label="Close panel">x</button>
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

          <div className="actions">
            <span className={`status status-${isStale ? 'warning' : 'success'}`}>
              {isStale ? 'Global stale state detected' : 'Global data freshness healthy'}
            </span>
            <button className="btn btn-primary" onClick={() => refreshAll()}>
              Refresh All Pipelines
            </button>
          </div>
        </div>
      )}

      {activeTab === 'inverter' && (
        <div className="pipeline-body">
          <div className="health-grid">
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
          </div>

          {(!hasInverterInfo && !hasAlarmData && !hasPerformanceData && !inverterLoading && !inverterError) ? (
            <div className="panel-card">
              <h4>Inverter Diagnostics</h4>
              <div className="empty">No inverter diagnostics data returned yet. Click refresh to retry.</div>
            </div>
          ) : (
            <>
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

              {(hasPerformanceData || hasAlarmData) && (
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

                  {hasAlarmData && (
                    <div className="panel-card">
                      <h4>Alarm Ledger</h4>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Level</th>
                            <th>State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inverterData.alarms.slice(0, 12).map((alarm, idx) => (
                            <tr key={`ledger-${idx}`}>
                              <td>{alarm.alarmCode || '-'}</td>
                              <td>{resolveAlarmName(alarm)}</td>
                              <td>{alarm.alarmLevel ?? '-'}</td>
                              <td>{resolveAlarmState(alarm.state)}</td>
                            </tr>
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
