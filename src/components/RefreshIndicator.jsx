import React from 'react';
import { useData } from '../hooks/useData';
import { FileWarning } from 'lucide-react';

const RefreshIndicator = () => {
  const { loading, lastUpdate, isStale, connectionStatus } = useData();
  const isAnyLoading = Object.values(loading).some(Boolean);
  const mostRecentUpdate = lastUpdate.live || lastUpdate.charts || Date.now();
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div style={containerStyle}>
      {isAnyLoading && (
        <div style={spinnerContainerStyle}>
          <div style={spinnerStyle} />
        </div>
      )}
      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className={isAnyLoading ? 'live-dot live' : 'live-dot'} aria-label={isAnyLoading ? 'Live updating' : 'Idle'} />
        Last updated {formatTimestamp(mostRecentUpdate)}
        <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', color: connectionStatus === 'connected' ? 'var(--success-color)' : 'var(--error-color)' }}>
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </span>
      </span>
    </div>
  );
};

const containerStyle = {
  position: 'fixed',
  top: 50,
  right:25,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  background: 'rgba(10, 10, 12, 0.85)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '0.4rem 0.75rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

const spinnerContainerStyle = {
  display: 'flex',
  alignItems: 'center',
};

const spinnerStyle = {
  width: '14px',
  height: '14px',
  border: '2px solid rgba(0, 234, 255, 0.2)',
  borderTop: '2px solid var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const infoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: 'var(--text-color)',
};

const staleWarningStyle = {
  fontSize: '0.7rem',
  color: '#ff9800',
  fontWeight: 600,
};

// Add keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default RefreshIndicator;
