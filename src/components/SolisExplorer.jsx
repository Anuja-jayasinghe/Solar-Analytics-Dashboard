import React, { useEffect, useState, useRef, useMemo } from 'react';
import { formatResponse } from '../lib/solisResponseFormatters';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date) {
  return date.toISOString().slice(0, 7);
}

function getPrefillValueByKey(paramKey) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const staticMap = {
    id: '1298491919448631809',
    sn: '120B40198150131',
    stationId: '1298491919448631809',
    nmiCode: 'NMI001',
    pageNo: '1',
    pageSize: '10',
    timeZone: '8',
    money: 'LKR',
    state: '0',
    alarmDeviceSn: '120B40198150131',
  };

  if (paramKey === 'time' || paramKey === 'alarmEndTime') {
    return formatDate(today);
  }

  if (paramKey === 'alarmBeginTime') {
    return formatDate(sevenDaysAgo);
  }

  if (paramKey === 'month') {
    return formatMonth(today);
  }

  return staticMap[paramKey] || '';
}

function buildPrefilledParams(endpoint, existingParams = {}) {
  if (!endpoint || !endpoint.params) return endpoint?.sampleParams || {};

  const prefilled = {};
  Object.entries(endpoint.params).forEach(([paramKey, paramDef]) => {
    if (endpoint.sampleParams && endpoint.sampleParams[paramKey] !== undefined) {
      prefilled[paramKey] = endpoint.sampleParams[paramKey];
      return;
    }

    if (paramDef.default !== undefined) {
      prefilled[paramKey] = paramDef.default;
      return;
    }

    if (existingParams[paramKey]) {
      prefilled[paramKey] = existingParams[paramKey];
      return;
    }

    prefilled[paramKey] = getPrefillValueByKey(paramKey);
  });

  return prefilled;
}

const SolisExplorer = ({ open, onClose }) => {
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [formatted, setFormatted] = useState(null);
  const [rawJsonVisible, setRawJsonVisible] = useState(false);
  const [durationMs, setDurationMs] = useState(null);
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsError, setEndpointsError] = useState(null);
  const panelRef = useRef(null);

  // Fetch endpoint list on mount
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        setEndpointsLoading(true);
        setEndpointsError(null);
        const res = await fetch('/api/solis/explore-endpoints');
        const body = await res.text();
        let data;
        try {
          data = JSON.parse(body);
        } catch (parseError) {
          setEndpoints([]);
          setEndpointsError('Endpoint API returned non-JSON response.');
          return;
        }

        if (res.ok) {
          setEndpoints(data.endpoints || []);
        } else {
          setEndpointsError(data.error || 'Failed to fetch endpoints from API.');
          setEndpoints([]);
        }
      } catch (e) {
        console.error('Failed to fetch endpoints:', e);
        setEndpointsError(e.message || 'Network error');
        setEndpoints([]);
      } finally {
        setEndpointsLoading(false);
      }
    };

    if (open) {
      fetchEndpoints();
    }
  }, [open]);

  // Update params when endpoint changes
  useEffect(() => {
    if (selectedEndpoint && endpoints.length > 0) {
      const endpoint = endpoints.find((e) => e.key === selectedEndpoint);
      if (endpoint) {
        setParams((prev) => buildPrefilledParams(endpoint, prev));
        setResponse(null);
        setFormatted(null);
        setError(null);
      }
    }
  }, [selectedEndpoint, endpoints]);

  // Execute API call
  const executeCall = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const endpointConfig = endpoints.find((e) => e.key === selectedEndpoint);
      const res = await fetch('/api/solis/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointKey: selectedEndpoint,
          params,
        }),
      });

      const body = await res.text();
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error('API endpoint returned non-JSON response. Start your backend API and retry.');
      }
      setDurationMs(Date.now() - startTime);

      if (!res.ok) {
        const errorParts = [data.error || `API call failed (${res.status})`];
        if (data.message) errorParts.push(data.message);
        if (Array.isArray(data.details) && data.details.length > 0) {
          errorParts.push(data.details.join(', '));
        }
        setError(errorParts.join(' | '));
        setResponse(null);
        setFormatted(null);
      } else {
        setResponse(data);
        const fmt = formatResponse(data.solisResponse, endpointConfig?.formatterKey);
        setFormatted(fmt);
      }
    } catch (err) {
      setDurationMs(Date.now() - startTime);
      setError(err.message || 'API request failed');
      setResponse(null);
      setFormatted(null);
    } finally {
      setLoading(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const selectedEndpointConfig = useMemo(() => {
    return endpoints.find((e) => e.key === selectedEndpoint);
  }, [selectedEndpoint, endpoints]);

  // Group endpoints by category
  const endpointsByCategory = useMemo(() => {
    const grouped = {};
    endpoints.forEach((ep) => {
      if (!grouped[ep.category]) grouped[ep.category] = [];
      grouped[ep.category].push(ep);
    });
    return grouped;
  }, [endpoints]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="solis-explorer-panel">
      <style>{`
        .solis-explorer-panel {
          position: fixed;
          bottom: 20px;
          left: 80px; /* Position next to the sidebar (60px + 20px gap) */
          width: 900px;
          max-height: 85vh;
          background: rgba(20, 20, 25, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
          overflow: hidden;
          /* Connect visually to sidebar trigger */
          transform-origin: bottom left;
          animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95) translateX(-10px); }
          100% { opacity: 1; transform: scale(1) translateX(0); }
        }

        .solis-explorer-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
        }

        .solis-explorer-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--accent);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .solis-explorer-close {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 18px;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .solis-explorer-close:hover {
          background: rgba(255, 68, 68, 0.2);
          color: #ff4444;
          border-color: rgba(255, 68, 68, 0.4);
        }

        .solis-explorer-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          gap: 20px;
          padding: 20px;
        }

        .solis-explorer-left-panel {
          flex: 0 0 35%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          padding-right: 20px;
        }

        .solis-explorer-section-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .solis-explorer-endpoints-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .solis-explorer-endpoint-btn {
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.2);
          color: var(--text-color);
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .solis-explorer-endpoint-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .solis-explorer-endpoint-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #000;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(255, 122, 0, 0.3);
        }

        .solis-explorer-right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
        }

        .solis-explorer-params-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .solis-explorer-param-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .solis-explorer-param-label {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .solis-explorer-param-input {
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.25);
          color: var(--text-color);
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .solis-explorer-param-input:focus {
          outline: none;
          border-color: var(--accent);
          background: rgba(0, 0, 0, 0.4);
          box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.2);
        }

        .solis-explorer-actions {
          display: flex;
          gap: 8px;
        }

        .solis-explorer-button {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: var(--accent);
          color: #000;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 15px rgba(255, 122, 0, 0.3);
        }

        .solis-explorer-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 122, 0, 0.4);
        }

        .solis-explorer-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .solis-explorer-response-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 300px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          overflow: hidden;
        }

        .solis-explorer-response-header {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .solis-explorer-response-meta {
          font-size: 11px;
          color: var(--text-secondary);
          display: flex;
          gap: 12px;
        }

        .solis-explorer-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .solis-explorer-meta-status-ok {
          color: var(--success-color);
          font-weight: 600;
        }

        .solis-explorer-meta-status-error {
          color: var(--error-color);
          font-weight: 600;
        }

        .solis-explorer-json-toggle {
          padding: 6px 12px;
          font-size: 11px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          color: var(--text-secondary);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .solis-explorer-json-toggle:hover {
          color: var(--text-color);
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .solis-explorer-response-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          font-size: 13px;
        }

        .solis-explorer-placeholder {
          color: var(--text-muted);
          text-align: center;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .solis-explorer-error {
          color: var(--error-color);
          background: rgba(255, 68, 68, 0.05);
          padding: 12px;
          border-radius: 8px;
          margin: 12px 0;
          border-left: 3px solid var(--error-color);
        }

        .solis-explorer-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }

        .solis-explorer-table th {
          background: rgba(255, 255, 255, 0.02);
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .solis-explorer-table td {
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          word-break: break-word;
          color: var(--text-color);
        }

        .solis-explorer-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        .solis-explorer-detail-section {
          margin: 12px 0;
        }

        .solis-explorer-detail-section-title {
          font-weight: 600;
          color: var(--accent);
          margin: 8px 0 6px 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .solis-explorer-detail-field {
          display: flex;
          padding: 6px 0;
          font-size: 12px;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        }

        .solis-explorer-detail-label {
          font-weight: 600;
          color: var(--text-secondary);
          width: 140px;
          flex-shrink: 0;
        }

        .solis-explorer-detail-value {
          color: var(--text-color);
          word-break: break-word;
          flex: 1;
        }

        .solis-explorer-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(255, 122, 0, 0.1);
          color: var(--accent);
          border: 1px solid rgba(255, 122, 0, 0.2);
        }

        .solis-explorer-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .solis-explorer-endpoints-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 12px;
        }

        @media (max-width: 1200px) {
          .solis-explorer-panel {
            width: calc(100vw - 40px);
            max-height: 80vh;
          }
        }

        @media (max-width: 768px) {
          .solis-explorer-panel {
            right: 10px;
            left: 10px;
            bottom: 10px;
            width: calc(100vw - 20px);
            max-height: calc(100vh - 30px);
          }

          .solis-explorer-body {
            flex-direction: column;
            gap: 16px;
            padding: 16px;
          }

          .solis-explorer-left-panel {
            flex: 0 0 auto;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-right: 0;
            padding-bottom: 16px;
          }

          .solis-explorer-endpoints-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* Header */}
      <div className="solis-explorer-header">
        <h3>🔍 SolisCloud Explorer</h3>
        <button className="solis-explorer-close" onClick={onClose}>×</button>
      </div>

      {/* Body */}
      <div className="solis-explorer-body">
        {/* Left Panel - Endpoints List */}
        <div className="solis-explorer-left-panel">
          <div>
            <div className="solis-explorer-section-title">Available Endpoints</div>
            {endpointsLoading ? (
              <div className="solis-explorer-endpoints-loading">
                <span className="solis-explorer-spinner" />
                Loading endpoints...
              </div>
            ) : endpointsError ? (
              <div className="solis-explorer-error">
                <strong>Error loading endpoints:</strong> {endpointsError}
              </div>
            ) : endpoints.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px 0' }}>
                No endpoints available
              </div>
            ) : (
              <div className="solis-explorer-endpoints-grid">
                {endpoints.map((ep) => (
                  <button
                    key={ep.key}
                    className={`solis-explorer-endpoint-btn ${selectedEndpoint === ep.key ? 'active' : ''}`}
                    onClick={() => setSelectedEndpoint(ep.key)}
                    title={ep.description}
                  >
                    {ep.key}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Parameters & Response */}
        <div className="solis-explorer-right-panel">
          {/* Parameters Section */}
          {selectedEndpointConfig && (
            <div className="solis-explorer-params-section">
              <div>
                <div className="solis-explorer-section-title">{selectedEndpointConfig.category} - {selectedEndpointConfig.description}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {Object.entries(selectedEndpointConfig.params).map(([key, def]) => (
                  <div key={key} className="solis-explorer-param-group">
                    <label className="solis-explorer-param-label">
                      {key}
                      {def.required && <span style={{ color: 'var(--error-color)' }}> *</span>}
                    </label>
                    <input
                      type="text"
                      value={params[key] || ''}
                      onChange={(e) => setParams({ ...params, [key]: e.target.value })}
                      placeholder={def.description}
                      className="solis-explorer-param-input"
                    />
                  </div>
                ))}
              </div>

              <div className="solis-explorer-actions">
                <button
                  className="solis-explorer-button"
                  onClick={executeCall}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="solis-explorer-spinner" /> Fetching...
                    </>
                  ) : (
                    'Execute →'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Response Section */}
          {response || error ? (
            <div className="solis-explorer-response-section">
              <div className="solis-explorer-response-header">
                <div className="solis-explorer-response-meta">
                  <div className="solis-explorer-meta-item">
                    <span className={`solis-explorer-meta-status-${response?.ok ? 'ok' : 'error'}`}>
                      {response?.ok ? '✓ Success' : '✗ Error'}
                    </span>
                  </div>
                  {durationMs && (
                    <div className="solis-explorer-meta-item">
                      ⏱ {durationMs}ms
                    </div>
                  )}
                  {response?.rateLimit && (
                    <div className="solis-explorer-meta-item">
                      🔄 {response.rateLimit.remaining} remaining
                    </div>
                  )}
                </div>
                <button
                  className="solis-explorer-json-toggle"
                  onClick={() => setRawJsonVisible(!rawJsonVisible)}
                >
                  {rawJsonVisible ? '📄 Formatted' : '{}  JSON'}
                </button>
              </div>

              <div className="solis-explorer-response-content">
                {error && (
                  <div className="solis-explorer-error">
                    <strong>Error:</strong> {error}
                  </div>
                )}
                {rawJsonVisible ? (
                  <div className="solis-explorer-json-block">
                    {JSON.stringify(response?.solisResponse, null, 2)}
                  </div>
                ) : (
                  renderFormatted(formatted)
                )}
              </div>
            </div>
          ) : (
            <div className="solis-explorer-response-section">
              <div className="solis-explorer-placeholder">
                <span>📊</span>
                <span>Select an endpoint and click Execute to view data</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Render formatted response based on type
 */
function renderFormatted(formatted) {
  if (!formatted) return <p style={{ color: 'var(--text-muted)' }}>No response</p>;

  const { type, items = [], sections = [] } = formatted;

  if (type === 'empty') {
    return <p style={{ color: 'var(--text-muted)' }}>No data</p>;
  }

  if (type === 'paginated-list' || type === 'array-list') {
    if (!items.length) return <p style={{ color: 'var(--text-muted)' }}>No items</p>;

    const keys = Object.keys(items[0]).slice(0, 6);
    return (
      <>
        <table className="solis-explorer-table">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 50).map((item, idx) => (
              <tr key={idx}>
                {keys.map((k) => (
                  <td key={k}>{typeof item[k] === 'object' ? JSON.stringify(item[k]) : String(item[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 50 && <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>... and {items.length - 50} more items</p>}
      </>
    );
  }

  if (type === 'time-series-array' || type === 'time-series-single') {
    if (!items.length) return <p style={{ color: 'var(--text-muted)' }}>No series data</p>;

    return (
      <table className="solis-explorer-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 30).map((item, idx) => (
            <tr key={idx}>
              <td>{item.timestampStr || new Date(item.timestamp).toLocaleString()}</td>
              <td>{item.valueStr ? `${item.value} ${item.valueStr}` : item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (type === 'detail-object') {
    return (
      <div>
        {sections.map((sec) => (
          <div key={sec.title} className="solis-explorer-detail-section">
            <div className="solis-explorer-detail-section-title">{sec.title}</div>
            {sec.fields.map((field) => (
              <div key={field.label} className="solis-explorer-detail-field">
                <div className="solis-explorer-detail-label">{field.label}</div>
                <div className="solis-explorer-detail-value">
                  {field.badge ? (
                    <span className="solis-explorer-badge">{field.value}</span>
                  ) : (
                    <>
                      {field.value} {field.unit && <span style={{ color: 'var(--text-secondary)' }}>{field.unit}</span>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return <p style={{ color: 'var(--text-muted)' }}>Unknown format type: {type}</p>;
}

export default SolisExplorer;
