import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { FileWarning, ChevronRight, ChevronLeft } from 'lucide-react';

const RefreshIndicator = () => {
  const { loading, lastUpdate, isStale, errors } = useData();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isAnyLoading = Object.values(loading).some(Boolean);
  const mostRecentUpdate = lastUpdate.live || lastUpdate.charts || Date.now();
  
  // Check if we have any errors - if so, consider it offline
  const hasErrors = errors && Object.values(errors).some(err => err !== null);
  const isOnline = !hasErrors;
  
  useEffect(() => {
    // Add keyframes to document
    const styleId = 'refresh-indicator-animations';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideInFromRight {
          0% { 
            opacity: 0;
            transform: translateX(20px);
          }
          100% { 
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes rotateIn {
          0% { 
            opacity: 0;
            transform: rotate(-90deg) scale(0.8);
          }
          100% { 
            opacity: 1;
            transform: rotate(0deg) scale(1);
          }
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);
  
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
    <div 
      style={{
        ...containerStyle,
        width: '36px',
        height: isCollapsed ? '36px' : 'auto',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        transform: 'translateY(-50%)',
        overflow: 'hidden'
      }}
      onClick={() => setIsCollapsed(!isCollapsed)}
      title={isCollapsed ? 'Click to expand' : 'Click to collapse'}
    >
      {isCollapsed ? (
        <span className={isAnyLoading ? 'live-dot live' : 'live-dot'} style={{ margin: 0 }} aria-label={isAnyLoading ? 'Live updating' : 'Idle'} />
      ) : (
        <>
          {isAnyLoading ? (
            <div style={{
              ...spinnerContainerStyle,
              animation: 'fadeIn 0.3s ease-in',
              marginBottom: '4px'
            }}>
              <div style={spinnerStyle} />
            </div>
          ) : (
            <span className="live-dot" style={{ margin: '4px 0' }} aria-label="Idle" />
          )}

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '8px',
            animation: 'fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <span style={{ 
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              margin: '8px 0'
            }}>
              UPDATE {formatTimestamp(mostRecentUpdate)}
            </span>
            
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isOnline ? 'var(--success-color)' : 'var(--error-color)',
              boxShadow: isOnline ? '0 0 6px var(--success-color)' : '0 0 6px var(--error-color)',
              marginBottom: '4px'
            }} title={isOnline ? 'Online' : 'Offline'} />
          </div>
        </>
      )}
    </div>
  );
};

const containerStyle = {
  position: 'fixed',
  top: '50%',
  right: '24px',
  zIndex: 900,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: 'rgba(20, 20, 25, 0.65)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '30px',
  padding: '12px 6px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

const spinnerContainerStyle = {
  display: 'flex',
  alignItems: 'center',
};

const spinnerStyle = {
  width: '12px',
  height: '12px',
  border: '2px solid var(--text-muted)',
  borderTopColor: 'var(--accent)',
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

export default RefreshIndicator;
