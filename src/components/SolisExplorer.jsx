import React, { useEffect, useMemo, useRef } from 'react';
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

export default function SolisExplorer({ open, onClose }) {
  const panelRef = useRef(null);
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
      .slice(0, 6);
  }, [sourceRows]);

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
          width: min(980px, calc(100vw - 110px));
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

          .pipeline-metrics {
            grid-template-columns: repeat(2, minmax(130px, 1fr));
          }

          .pipeline-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="pipeline-header">
        <div>
          <div className="pipeline-title">Data Pipeline Health</div>
          <div className="pipeline-subtitle">Operational telemetry for ingestion, freshness, and reliability</div>
        </div>
        <button className="pipeline-close" onClick={onClose} aria-label="Close panel">x</button>
      </div>

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
    </div>
  );
}
