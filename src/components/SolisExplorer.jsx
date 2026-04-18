import React, { useEffect, useState, useRef, useMemo } from 'react';
import { formatResponse } from '../lib/solisResponseFormatters';
import solisExplorerFallbackEndpoints from '../lib/solisExplorerFallbackEndpoints';

function getLocalEndpointsFallback() {
  return solisExplorerFallbackEndpoints;
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
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState('');
  const panelRef = useRef(null);

  // Fetch endpoint list on mount
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        setEndpointsLoading(true);
        setEndpointsError(null);
        setUsingLocalFallback(false);
        setFallbackMessage('');
        const res = await fetch('/api/solis/explore-endpoints');
        const body = await res.text();
        let data;
        try {
          data = JSON.parse(body);
        } catch (parseError) {
          const fallbackEndpoints = getLocalEndpointsFallback();
          setEndpoints(fallbackEndpoints);
          setUsingLocalFallback(true);
          setFallbackMessage('API endpoint is not returning JSON in local dev. Using local endpoint list fallback.');
          setEndpointsError(null);
          return;
        }

        if (res.ok) {
          setEndpoints(data.endpoints || []);
        } else {
          const fallbackEndpoints = getLocalEndpointsFallback();
          setEndpoints(fallbackEndpoints);
          setUsingLocalFallback(true);
          setFallbackMessage(data.error || 'Failed to fetch endpoints from API. Using local endpoint list fallback.');
          setEndpointsError(null);
        }
      } catch (e) {
        console.error('Failed to fetch endpoints:', e);
        const fallbackEndpoints = getLocalEndpointsFallback();
        setEndpoints(fallbackEndpoints);
        setUsingLocalFallback(true);
        setFallbackMessage((e.message || 'Network error') + ' Using local endpoint list fallback.');
        setEndpointsError(null);
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
        setParams(endpoint.sampleParams || {});
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
        throw new Error('API endpoint returned non-JSON response. In local dev, run Vercel API server and set Vite proxy for /api.');
      }
      setDurationMs(Date.now() - startTime);

      if (!res.ok) {
        setError(data.error || 'API call failed');
        setResponse(null);
        setFormatted(null);
      } else {
        setResponse(data);
        const endpointConfig = endpoints.find((e) => e.key === selectedEndpoint);
        const fmt = formatResponse(data.solisResponse, endpointConfig?.formatterKey);
        setFormatted(fmt);
      }
    } catch (err) {
      setError(err.message);
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
          right: 20px;
          width: 900px;
          max-height: 85vh;
          background: var(--card-bg-solid);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          box-shadow: 0 8px 24px var(--card-shadow);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
          overflow: hidden;
        }

        .solis-explorer-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--card-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, rgba(255, 122, 0, 0.1) 0%, rgba(0, 194, 168, 0.05) 100%);
        }

        .solis-explorer-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-color);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .solis-explorer-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .solis-explorer-close:hover {
          background: var(--hover-bg);
          color: var(--text-color);
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
          border-right: 1px solid var(--card-border);
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
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-color);
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .solis-explorer-endpoint-btn:hover {
          background: var(--hover-bg);
          border-color: var(--accent);
        }

        .solis-explorer-endpoint-btn.active {
          background: linear-gradient(135deg, rgba(255, 122, 0, 0.2) 0%, rgba(0, 194, 168, 0.1) 100%);
          border-color: var(--accent);
          color: var(--accent);
          font-weight: 600;
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
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-color);
          border-radius: 6px;
          font-size: 12px;
          font-family: monospace;
          transition: all 0.2s;
        }

        .solis-explorer-param-input:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--hover-bg);
        }

        .solis-explorer-actions {
          display: flex;
          gap: 8px;
        }

        .solis-explorer-button {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--card-border);
          background: linear-gradient(135deg, rgba(255, 122, 0, 0.2) 0%, rgba(0, 194, 168, 0.1) 100%);
          color: var(--accent);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .solis-explorer-button:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255, 122, 0, 0.3) 0%, rgba(0, 194, 168, 0.15) 100%);
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .solis-explorer-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .solis-explorer-response-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 300px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          overflow: hidden;
        }

        .solis-explorer-response-header {
          padding: 12px 16px;
          background: var(--hover-bg);
          border-bottom: 1px solid var(--card-border);
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
        }

        .solis-explorer-meta-status-error {
          color: var(--error-color);
        }

        .solis-explorer-json-toggle {
          padding: 6px 12px;
          font-size: 11px;
          background: var(--card-border);
          border: 1px solid var(--card-border);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .solis-explorer-json-toggle:hover {
          color: var(--accent);
          border-color: var(--accent);
        }

        .solis-explorer-response-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          font-size: 12px;
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
          background: rgba(255, 68, 68, 0.1);
          padding: 12px;
          border-radius: 6px;
          margin: 12px 0;
          border-left: 3px solid var(--error-color);
        }

        .solis-explorer-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .solis-explorer-table th {
          background: var(--hover-bg);
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--card-border);
          font-weight: 600;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .solis-explorer-table td {
          padding: 8px;
          border-bottom: 1px solid var(--card-border);
          word-break: break-word;
        }

        .solis-explorer-table tr:hover {
          background: var(--hover-bg);
        }

        .solis-explorer-detail-section {
          margin: 12px 0;
        }

        .solis-explorer-detail-section-title {
          font-weight: 600;
          color: var(--accent);
          margin: 8px 0 6px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .solis-explorer-detail-field {
          display: flex;
          padding: 4px 0;
          font-size: 11px;
          gap: 12px;
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
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          background: rgba(0, 194, 168, 0.2);
          color: var(--accent-secondary);
          border: 1px solid rgba(0, 194, 168, 0.4);
        }

        .solis-explorer-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid var(--card-border);
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
            border-bottom: 1px solid var(--card-border);
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
          background: var(--card-bg);
        }

        ::-webkit-scrollbar-thumb {
          background: var(--card-border);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
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
              <>
                {usingLocalFallback && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '8px 0 12px' }}>
                    {fallbackMessage || 'Local fallback list loaded.'}
                  </div>
                )}
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
              </>
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
