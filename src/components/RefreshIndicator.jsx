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
        width: isCollapsed ? '40px' : 'auto',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isCollapsed ? 'translateX(0)' : 'translateX(0)',
        overflow: 'hidden'
      }}
      onClick={() => setIsCollapsed(!isCollapsed)}
      title={isCollapsed ? 'Click to expand' : 'Click to collapse'}
    >
      {isAnyLoading && !isCollapsed && (
        <div style={{
          ...spinnerContainerStyle,
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <div style={spinnerStyle} />
        </div>
      )}
      
      {isCollapsed ? (
        <ChevronLeft 
          size={20} 
          style={{ 
            color: 'var(--text-secondary)',
            animation: 'rotateIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      ) : (
        <>
          <span style={{ 
            color: 'var(--text-secondary)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            animation: 'slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <span className={isAnyLoading ? 'live-dot live' : 'live-dot'} aria-label={isAnyLoading ? 'Live updating' : 'Idle'} />
            Last updated {formatTimestamp(mostRecentUpdate)}
            <span style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', color: isOnline ? 'var(--success-color)' : 'var(--error-color)' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </span> 
          <ChevronRight 
            size={16} 
            style={{ 
              color: 'var(--text-muted)', 
              marginLeft: '4px',
              animation: 'pulse 2s ease-in-out infinite'
            }} 
          />
        </>
      )}
    </div>
  );
};

const containerStyle = {
  position: 'fixed',
  top: 98,
  right:25,
  zIndex: 800,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  background: 'var(--card-bg-solid)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--card-border)',
  borderRadius: '8px',
  padding: '0.4rem 0.75rem',
  boxShadow: '0 4px 12px var(--card-shadow)',
};

const spinnerContainerStyle = {
  display: 'flex',
  alignItems: 'center',
};

const spinnerStyle = {
  width: '14px',
  height: '14px',
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
