import React, { useEffect, useState, useRef, useMemo } from 'react';
import { formatResponse } from '../lib/solisResponseFormatters';

const SolisExplorer = ({ open, onClose }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [formatted, setFormatted] = useState(null);
  const [rawJsonVisible, setRawJsonVisible] = useState(false);
  const [durationMs, setDurationMs] = useState(null);
  const panelRef = useRef(null);

  // Fetch endpoint list on mount
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const res = await fetch('/api/solis/explore-endpoints');
        if (res.ok) {
          const data = await res.json();
          setEndpoints(data.endpoints || []);
          if (data.endpoints?.length > 0) {
            setSelectedEndpoint(data.endpoints[0].key);
            setParams(data.endpoints[0].sampleParams || {});
          }
        }
      } catch (e) {
        console.error('Failed to fetch endpoints:', e);
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

      const data = await res.json();
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
    <>
      <style>{`
        .solis-explorer-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 700px;
          max-height: 85vh;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        }

        .solis-explorer-header {
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
        }

        .solis-explorer-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .solis-explorer-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .solis-explorer-close:hover {
          color: #000;
        }

        .solis-explorer-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .solis-explorer-section {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .solis-explorer-section-title {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .solis-explorer-select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
          background: white;
        }

        .solis-explorer-params {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .solis-explorer-param-group {
          display: flex;
          flex-direction: column;
        }

        .solis-explorer-param-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .solis-explorer-param-input {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          font-family: monospace;
        }

        .solis-explorer-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .solis-explorer-button {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .solis-explorer-button-primary {
          background: #0066cc;
          color: white;
        }

        .solis-explorer-button-primary:hover:not(:disabled) {
          background: #0052a3;
        }

        .solis-explorer-button-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .solis-explorer-response {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .solis-explorer-response-header {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .solis-explorer-response-meta {
          font-size: 11px;
          color: #666;
        }

        .solis-explorer-response-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          font-size: 12px;
        }

        .solis-explorer-error {
          color: #d32f2f;
          background: #ffebee;
          padding: 12px;
          border-radius: 4px;
          margin: 12px 16px;
        }

        .solis-explorer-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .solis-explorer-table th,
        .solis-explorer-table td {
          padding: 6px 8px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }

        .solis-explorer-table th {
          background: #f5f5f5;
          font-weight: 600;
          color: #333;
        }

        .solis-explorer-table tr:hover {
          background: #fafafa;
        }

        .solis-explorer-detail-section {
          margin: 12px 0;
        }

        .solis-explorer-detail-section-title {
          font-weight: 600;
          color: #333;
          margin: 8px 0 6px 0;
          font-size: 12px;
        }

        .solis-explorer-detail-field {
          display: flex;
          padding: 4px 0;
          font-size: 12px;
        }

        .solis-explorer-detail-label {
          font-weight: 500;
          color: #666;
          width: 140px;
          flex-shrink: 0;
        }

        .solis-explorer-detail-value {
          color: #333;
          word-break: break-word;
          font-family: monospace;
        }

        .solis-explorer-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
          background: #e3f2fd;
          color: #1976d2;
        }

        .solis-explorer-json-toggle {
          padding: 4px 8px;
          font-size: 11px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
        }

        .solis-explorer-json-block {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 300px;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .solis-explorer-panel {
            right: 10px;
            left: 10px;
            bottom: 10px;
            width: calc(100vw - 20px);
            max-height: calc(100vh - 30px);
          }

          .solis-explorer-params {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div ref={panelRef} className="solis-explorer-panel">
        {/* Header */}
        <div className="solis-explorer-header">
          <h3>🔍 SolisCloud Explorer</h3>
          <button className="solis-explorer-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="solis-explorer-body">
          {/* Endpoint Selection */}
          <div className="solis-explorer-section">
            <div className="solis-explorer-section-title">Endpoint</div>
            <select
              value={selectedEndpoint || ''}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="solis-explorer-select"
            >
              <option value="">-- Select Endpoint --</option>
              {Object.entries(endpointsByCategory).map(([category, eps]) => (
                <optgroup label={category} key={category}>
                  {eps.map((ep) => (
                    <option key={ep.key} value={ep.key}>
                      {ep.key} - {ep.description?.substring(0, 40)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedEndpointConfig && (
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
                {selectedEndpointConfig.description}
              </p>
            )}
          </div>

          {/* Parameters */}
          {selectedEndpointConfig && (
            <div className="solis-explorer-section">
              <div className="solis-explorer-section-title">Parameters</div>
              <div className="solis-explorer-params">
                {Object.entries(selectedEndpointConfig.params).map(([key, def]) => (
                  <div key={key} className="solis-explorer-param-group">
                    <label className="solis-explorer-param-label">
                      {key}
                      {def.required && <span style={{ color: 'red' }}>*</span>}
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
                  className="solis-explorer-button solis-explorer-button-primary"
                  onClick={executeCall}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Execute →'}
                </button>
              </div>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="solis-explorer-response">
              <div className="solis-explorer-response-header">
                <span className="solis-explorer-response-meta">
                  {response.ok ? '✓ Success' : '✗ Error'} · {durationMs}ms
                </span>
                <button
                  className="solis-explorer-json-toggle"
                  onClick={() => setRawJsonVisible(!rawJsonVisible)}
                >
                  {rawJsonVisible ? 'Formatted ↓' : 'Raw JSON ↓'}
                </button>
              </div>

              <div className="solis-explorer-response-content">
                {rawJsonVisible ? (
                  <div className="solis-explorer-json-block">
                    {JSON.stringify(response.solisResponse, null, 2)}
                  </div>
                ) : (
                  renderFormatted(formatted)
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="solis-explorer-error">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * Render formatted response based on type
 */
function renderFormatted(formatted) {
  if (!formatted) return <p>No response</p>;

  const { type, items = [], sections = [] } = formatted;

  if (type === 'empty') {
    return <p style={{ color: '#999' }}>No data</p>;
  }

  if (type === 'paginated-list' || type === 'array-list') {
    if (!items.length) return <p style={{ color: '#999' }}>No items</p>;

    const keys = Object.keys(items[0]).slice(0, 8);
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
        {items.length > 50 && <p style={{ marginTop: '8px', color: '#999', fontSize: '11px' }}>... and {items.length - 50} more items</p>}
      </>
    );
  }

  if (type === 'time-series-array' || type === 'time-series-single') {
    if (!items.length) return <p style={{ color: '#999' }}>No series data</p>;

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
                      {field.value} {field.unit && <span style={{ color: '#999' }}>{field.unit}</span>}
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

  return <p style={{ color: '#999' }}>Unknown format type: {type}</p>;
}

export default SolisExplorer;
