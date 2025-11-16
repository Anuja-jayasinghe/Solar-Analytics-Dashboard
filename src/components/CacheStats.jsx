import React, { useState, useEffect } from 'react';
import { cacheService } from '../lib/cacheService';

const CacheStats = () => {
  const [stats, setStats] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const refreshStats = () => {
    const cacheStats = cacheService.getStats();
    setStats(cacheStats);
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    if (window.confirm('Clear all cache? This will reload the page.')) {
      cacheService.clear();
      window.location.reload();
    }
  };

  if (!stats) return null;

  return (
    <div style={containerStyle}>
      <button 
        style={toggleButtonStyle} 
        onClick={() => setIsExpanded(!isExpanded)}
        title="Cache Statistics"
      >
        📊 Cache {isExpanded ? '▼' : '▶'}
      </button>

      {isExpanded && (
        <div style={panelStyle}>
          <div style={headerStyle}>
            <h3 style={titleStyle}>Cache Statistics</h3>
            <div style={actionsStyle}>
              <button style={actionButton} onClick={refreshStats}>
                🔄 Refresh
              </button>
              <button style={actionButton} onClick={handleClearCache}>
                🗑️ Clear All
              </button>
            </div>
          </div>

          {/* Summary Metrics */}
          <div style={metricsGridStyle}>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Total Entries</div>
              <div style={metricValueStyle}>{stats.totalSize}</div>
              <div style={metricSubtextStyle}>
                {stats.memorySize} memory, {stats.localStorageSize} storage
              </div>
            </div>

            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Cache Size</div>
              <div style={metricValueStyle}>{stats.totalKB} KB</div>
              <div style={metricSubtextStyle}>
                {stats.totalMB} MB total
              </div>
            </div>

            <div style={{ ...metricCardStyle, borderColor: stats.hitRateNumeric > 70 ? '#22c55e' : '#f59e0b' }}>
              <div style={metricLabelStyle}>Hit Rate</div>
              <div style={metricValueStyle}>{stats.hitRate}</div>
              <div style={metricSubtextStyle}>
                {stats.hits} hits, {stats.misses} misses
              </div>
            </div>

            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Operations</div>
              <div style={metricValueStyle}>{stats.sets}</div>
              <div style={metricSubtextStyle}>
                {stats.deletes} deletes, {stats.evictions} evicted
              </div>
            </div>
          </div>

          {/* Detailed Entry List */}
          <div style={entriesContainerStyle}>
            <h4 style={sectionTitleStyle}>Cached Entries</h4>
            <div style={entriesListStyle}>
              {stats.entries && stats.entries.length > 0 ? (
                stats.entries.map((entry, index) => (
                  <div key={index} style={entryRowStyle}>
                    <div style={entryNameStyle}>
                      {entry.key}
                      {entry.expired && <span style={expiredBadgeStyle}>EXPIRED</span>}
                    </div>
                    <div style={entryDetailsStyle}>
                      <span>{(entry.bytes / 1024).toFixed(2)} KB</span>
                      <span>Age: {formatTime(entry.age)}</span>
                      <span>TTL: {entry.ttl > 0 ? formatTime(entry.ttl) : 'Expired'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={emptyStateStyle}>No cache entries</div>
              )}
            </div>
          </div>

          {/* Performance Chart */}
          <div style={chartContainerStyle}>
            <h4 style={sectionTitleStyle}>Performance</h4>
            <div style={chartBarContainerStyle}>
              <div style={chartBarStyle}>
                <div 
                  style={{
                    ...chartBarFillStyle,
                    width: `${stats.hitRateNumeric}%`,
                    background: stats.hitRateNumeric > 70 ? '#22c55e' : '#f59e0b'
                  }}
                >
                  {stats.hitRate}
                </div>
              </div>
              <div style={chartLegendStyle}>
                <span>Hit Rate Target: 70%+</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

// Styles
const containerStyle = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 9999,
};

const toggleButtonStyle = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.2s ease',
};

const panelStyle = {
  position: 'absolute',
  bottom: '60px',
  right: 0,
  width: '500px',
  maxHeight: '600px',
  overflowY: 'auto',
  background: 'var(--card-bg-solid)',
  border: '1px solid var(--card-border)',
  borderRadius: '12px',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  padding: '1.5rem',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottom: '1px solid var(--card-border)',
};

const titleStyle = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: '700',
  color: 'var(--text-primary)',
};

const actionsStyle = {
  display: 'flex',
  gap: '0.5rem',
};

const actionButton = {
  background: 'transparent',
  border: '1px solid var(--card-border)',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1rem',
  marginBottom: '1.5rem',
};

const metricCardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '8px',
  padding: '1rem',
};

const metricLabelStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginBottom: '0.5rem',
};

const metricValueStyle = {
  fontSize: '1.5rem',
  fontWeight: '700',
  color: 'var(--accent)',
  marginBottom: '0.25rem',
};

const metricSubtextStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
};

const entriesContainerStyle = {
  marginBottom: '1.5rem',
};

const sectionTitleStyle = {
  fontSize: '1rem',
  fontWeight: '600',
  color: 'var(--text-primary)',
  marginBottom: '0.75rem',
};

const entriesListStyle = {
  maxHeight: '200px',
  overflowY: 'auto',
  background: 'var(--card-bg)',
  borderRadius: '8px',
  padding: '0.5rem',
};

const entryRowStyle = {
  padding: '0.75rem',
  marginBottom: '0.5rem',
  background: 'var(--glass-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '6px',
};

const entryNameStyle = {
  fontSize: '0.85rem',
  fontWeight: '600',
  color: 'var(--text-primary)',
  marginBottom: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const expiredBadgeStyle = {
  fontSize: '0.7rem',
  color: '#ff4444',
  background: 'rgba(255, 68, 68, 0.1)',
  padding: '0.2rem 0.4rem',
  borderRadius: '4px',
  fontWeight: '600',
};

const entryDetailsStyle = {
  display: 'flex',
  gap: '1rem',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
};

const emptyStateStyle = {
  textAlign: 'center',
  padding: '2rem',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
};

const chartContainerStyle = {
  marginTop: '1.5rem',
};

const chartBarContainerStyle = {
  marginTop: '0.75rem',
};

const chartBarStyle = {
  width: '100%',
  height: '40px',
  background: 'var(--card-bg)',
  borderRadius: '8px',
  overflow: 'hidden',
  position: 'relative',
};

const chartBarFillStyle = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontWeight: '600',
  fontSize: '0.9rem',
  transition: 'width 0.3s ease',
};

const chartLegendStyle = {
  marginTop: '0.5rem',
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  textAlign: 'center',
};

export default CacheStats;
