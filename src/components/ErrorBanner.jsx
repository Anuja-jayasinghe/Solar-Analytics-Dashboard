import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';

const ErrorBanner = () => {
  const { errors } = useData();
  const [visibleErrors, setVisibleErrors] = useState([]);

  useEffect(() => {
    // Check for errors that are >5 minutes old (prolonged outages)
    const now = Date.now();
    const prolongedThreshold = 5 * 60 * 1000; // 5 minutes

    const prolongedErrors = Object.entries(errors)
      .filter(([key, error]) => {
        if (!error || typeof error === 'string') return false;
        const errorAge = now - (error.time || 0);
        return errorAge > prolongedThreshold;
      })
      .map(([key, error]) => ({
        key,
        message: error.message,
        type: error.type,
        duration: Math.floor((now - error.time) / 60000) // minutes
      }));

    setVisibleErrors(prolongedErrors);
  }, [errors]);

  const getErrorIcon = (type) => {
    switch (type) {
      case 'auth':
        return '🔒';
      case 'rate-limit':
        return '⏳';
      case 'server':
        return '🔧';
      case 'transient':
        return '📡';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = (type) => {
    switch (type) {
      case 'auth':
        return 'Authentication Issue';
      case 'rate-limit':
        return 'Rate Limit Exceeded';
      case 'server':
        return 'Server Error';
      case 'transient':
        return 'Connection Issue';
      default:
        return 'Service Issue';
    }
  };

  if (visibleErrors.length === 0) return null;

  return (
    <div style={bannerContainerStyle}>
      {visibleErrors.map((error) => (
        <div key={error.key} style={bannerStyle}>
          <div style={bannerContentStyle}>
            <span style={iconStyle}>{getErrorIcon(error.type)}</span>
            <div style={textContainerStyle}>
              <strong style={titleStyle}>{getErrorTitle(error.type)}</strong>
              <span style={messageStyle}>
                {error.key.charAt(0).toUpperCase() + error.key.slice(1)} data unavailable for {error.duration} minutes.
                {error.type === 'transient' && ' Retrying automatically...'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const bannerContainerStyle = {
  position: 'fixed',
  top: '70px', // Below navbar
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  width: '90%',
  maxWidth: '600px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const bannerStyle = {
  background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 87, 34, 0.15))',
  border: '1px solid rgba(255, 152, 0, 0.4)',
  borderRadius: '12px',
  padding: '1rem 1.25rem',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  animation: 'slideDown 0.3s ease-out',
};

const bannerContentStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
};

const iconStyle = {
  fontSize: '1.5rem',
  flexShrink: 0,
};

const textContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: 1,
};

const titleStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  fontWeight: '600',
};

const messageStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.85rem',
  opacity: 0.9,
};

export default ErrorBanner;
