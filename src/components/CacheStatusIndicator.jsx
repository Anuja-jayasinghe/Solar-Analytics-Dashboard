import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';

const CacheStatusIndicator = () => {
  const { cacheStats, lastRefresh, isBackgroundRefreshing } = useData();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show indicator for 3 seconds when data refreshes
    if (lastRefresh) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastRefresh]);

  if (!isVisible && !isBackgroundRefreshing) return null;

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <div style={containerStyle}>
      <div style={indicatorStyle}>
        {isBackgroundRefreshing ? (
          <>
            <div style={spinnerStyle}></div>
            <span>Refreshing data...</span>
          </>
        ) : (
          <>
            <div style={checkmarkStyle}>✓</div>
            <span>Data updated {formatTime(lastRefresh)}</span>
          </>
        )}
      </div>
      
      {cacheStats && (
        <div style={statsStyle}>
          <small>
            Cache: {cacheStats.memorySize} memory, {cacheStats.localStorageSize} storage
          </small>
        </div>
      )}
    </div>
  );
};

const containerStyle = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const indicatorStyle = {
  background: 'var(--card-bg)',
  color: 'var(--text-color)',
  padding: '0.5rem 1rem',
  borderRadius: '20px',
  boxShadow: '0 4px 12px var(--card-shadow)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--glass-border)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem',
  fontWeight: '500',
  animation: 'slideInRight 0.3s ease-out',
};

const spinnerStyle = {
  width: '16px',
  height: '16px',
  border: '2px solid var(--chart-grid)',
  borderTop: '2px solid var(--accent)',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const checkmarkStyle = {
  color: '#4ade80',
  fontSize: '1.2rem',
  fontWeight: 'bold',
};

const statsStyle = {
  background: 'rgba(0, 0, 0, 0.7)',
  color: 'var(--text-secondary)',
  padding: '0.25rem 0.5rem',
  borderRadius: '12px',
  fontSize: '0.75rem',
  backdropFilter: 'blur(5px)',
};

// Add keyframes for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default CacheStatusIndicator;
