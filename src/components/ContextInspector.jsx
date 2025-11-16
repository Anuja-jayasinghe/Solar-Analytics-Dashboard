import React, { useState } from 'react';
import { useData } from '../hooks/useData';

const ContextInspector = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const context = useData();

  // Extract relevant state for display
  const {
    energyChartsData,
    livePowerData,
    totalEarningsData,
    monthlyGenerationData,
    inverterPotentialValue,
    loading,
    errors,
    lastUpdate,
    isStale
  } = context;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const ago = Date.now() - timestamp;
    const seconds = Math.floor(ago / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  };

  const getStatusColor = (isLoading, hasError) => {
    if (hasError) return '#ff4444';
    if (isLoading) return '#f59e0b';
    return '#22c55e';
  };

  if (!isExpanded) {
    return (
      <div style={collapsedContainerStyle}>
        <button 
          style={toggleButtonStyle}
          onClick={() => setIsExpanded(true)}
          title="Open Context Inspector"
        >
          🔍 Context
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>🔍 Context Inspector</h3>
        <button style={closeButtonStyle} onClick={() => setIsExpanded(false)}>
          ✕
        </button>
      </div>

      <div style={contentStyle}>
        {/* Loading States */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Loading States</h4>
          <div style={stateGridStyle}>
            {Object.entries(loading).map(([key, value]) => (
              <div key={key} style={stateItemStyle}>
                <span 
                  style={{
                    ...statusDotStyle,
                    background: value ? '#f59e0b' : '#22c55e'
                  }}
                />
                <span style={stateKeyStyle}>{key}</span>
                <span style={stateValueStyle}>{value ? 'Loading...' : 'Ready'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Error States */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Error States</h4>
          <div style={stateGridStyle}>
            {Object.entries(errors).map(([key, error]) => (
              <div key={key} style={stateItemStyle}>
                <span 
                  style={{
                    ...statusDotStyle,
                    background: error ? '#ff4444' : '#22c55e'
                  }}
                />
                <span style={stateKeyStyle}>{key}</span>
                <span style={stateValueStyle}>
                  {error ? (
                    typeof error === 'object' ? (
                      <span title={error.message}>
                        {error.type} - {formatTimestamp(error.time)}
                      </span>
                    ) : (
                      error
                    )
                  ) : (
                    'No errors'
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Last Update Timestamps */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Last Update</h4>
          <div style={stateGridStyle}>
            {Object.entries(lastUpdate).map(([key, timestamp]) => (
              <div key={key} style={stateItemStyle}>
                <span 
                  style={{
                    ...statusDotStyle,
                    background: timestamp && (Date.now() - timestamp) < 10 * 60 * 1000 
                      ? '#22c55e' 
                      : '#f59e0b'
                  }}
                />
                <span style={stateKeyStyle}>{key}</span>
                <span style={stateValueStyle}>{formatTimestamp(timestamp)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Data Summaries */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Data Summary</h4>
          <div style={dataSummaryStyle}>
            <div style={dataItemStyle}>
              <strong>Live Power:</strong> {livePowerData?.currentPower?.value || 0} kW
            </div>
            <div style={dataItemStyle}>
              <strong>Monthly Gen:</strong> {monthlyGenerationData?.total?.toFixed(2) || 0} kWh
            </div>
            <div style={dataItemStyle}>
              <strong>Total Earnings:</strong> LKR {totalEarningsData?.total?.toFixed(2) || 0}
            </div>
            <div style={dataItemStyle}>
              <strong>Charts Data:</strong> {energyChartsData?.length || 0} entries
            </div>
            <div style={dataItemStyle}>
              <strong>Inverter Value:</strong> LKR {inverterPotentialValue?.total?.toFixed(2) || 0}
            </div>
          </div>
        </section>

        {/* Global State */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Global State</h4>
          <div style={stateItemStyle}>
            <span style={{
              ...statusDotStyle,
              background: isStale ? '#f59e0b' : '#22c55e'
            }} />
            <span style={stateKeyStyle}>isStale</span>
            <span style={stateValueStyle}>{isStale ? 'Yes (>10min)' : 'No'}</span>
          </div>
        </section>

        {/* Actions */}
        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>Actions</h4>
          <div style={actionsStyle}>
            <button style={actionButtonStyle} onClick={() => context.refreshData('live')}>
              Refresh Live
            </button>
            <button style={actionButtonStyle} onClick={() => context.refreshData('charts')}>
              Refresh Charts
            </button>
            <button style={actionButtonStyle} onClick={() => context.refreshAll()}>
              Refresh All
            </button>
            <button 
              style={{...actionButtonStyle, background: '#ff4444'}} 
              onClick={() => {
                context.refreshAll();
                console.log('Context State:', context);
              }}
            >
              Log to Console
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

// Styles
const collapsedContainerStyle = {
  position: 'fixed',
  bottom: '80px',
  right: '20px',
  zIndex: 9998,
};

const containerStyle = {
  position: 'fixed',
  top: '80px',
  right: '20px',
  width: '400px',
  maxHeight: 'calc(100vh - 100px)',
  overflowY: 'auto',
  background: 'var(--card-bg-solid)',
  border: '2px solid var(--accent)',
  borderRadius: '12px',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  zIndex: 9998,
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
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid var(--card-border)',
  background: 'linear-gradient(135deg, rgba(255, 122, 0, 0.1), rgba(0, 194, 168, 0.1))',
};

const titleStyle = {
  margin: 0,
  fontSize: '1.1rem',
  fontWeight: '700',
  color: 'var(--text-primary)',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '1.5rem',
  cursor: 'pointer',
  padding: '0.25rem 0.5rem',
  lineHeight: 1,
};

const contentStyle = {
  padding: '1.5rem',
};

const sectionStyle = {
  marginBottom: '1.5rem',
};

const sectionTitleStyle = {
  fontSize: '0.9rem',
  fontWeight: '600',
  color: 'var(--text-primary)',
  marginBottom: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const stateGridStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const stateItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem',
  background: 'var(--card-bg)',
  borderRadius: '6px',
  fontSize: '0.85rem',
};

const statusDotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  flexShrink: 0,
};

const stateKeyStyle = {
  fontWeight: '600',
  color: 'var(--text-primary)',
  minWidth: '100px',
};

const stateValueStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dataSummaryStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const dataItemStyle = {
  padding: '0.5rem',
  background: 'var(--card-bg)',
  borderRadius: '6px',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
};

const actionsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.5rem',
};

const actionButtonStyle = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.8rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

export default ContextInspector;
