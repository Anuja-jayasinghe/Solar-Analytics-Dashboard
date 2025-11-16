import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';

const AuthErrorModal = () => {
  const { errors } = useData();
  const [showModal, setShowModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);

  useEffect(() => {
    // Safety check
    if (!errors || typeof errors !== 'object') return;

    // Check if any error is an auth error (401/403)
    const authError = Object.entries(errors).find(([key, error]) => {
      return error && typeof error === 'object' && (error.type === 'auth');
    });

    if (authError) {
      setErrorDetails({
        key: authError[0],
        message: authError[1].message
      });
      setShowModal(true);
    }
  }, [errors]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <>
      <div style={overlayStyle} onClick={handleDismiss} />
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <span style={iconStyle}>🔒</span>
          <h2 style={titleStyle}>Authentication Required</h2>
        </div>
        
        <div style={modalBodyStyle}>
          <p style={messageStyle}>
            Your session has expired or authentication failed. Please refresh the page to continue.
          </p>
          <p style={detailsStyle}>
            <strong>Service:</strong> {errorDetails?.key}
          </p>
          <p style={detailsStyle}>
            <strong>Error:</strong> {errorDetails?.message}
          </p>
        </div>

        <div style={modalFooterStyle}>
          <button style={secondaryButtonStyle} onClick={handleDismiss}>
            Dismiss
          </button>
          <button style={primaryButtonStyle} onClick={handleReload}>
            🔄 Reload Page
          </button>
        </div>
      </div>
    </>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(4px)',
  zIndex: 9998,
  animation: 'fadeIn 0.3s ease-out',
};

const modalStyle = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'var(--card-bg-solid)',
  border: '1px solid var(--card-border)',
  borderRadius: '16px',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  width: '90%',
  maxWidth: '480px',
  zIndex: 9999,
  animation: 'slideUp 0.3s ease-out',
  overflow: 'hidden',
};

const modalHeaderStyle = {
  padding: '1.5rem',
  borderBottom: '1px solid var(--card-border)',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 87, 34, 0.1))',
};

const iconStyle = {
  fontSize: '2rem',
};

const titleStyle = {
  margin: 0,
  fontSize: '1.5rem',
  fontWeight: '700',
  color: 'var(--text-primary)',
};

const modalBodyStyle = {
  padding: '1.5rem',
};

const messageStyle = {
  marginBottom: '1rem',
  fontSize: '0.95rem',
  lineHeight: '1.6',
  color: 'var(--text-secondary)',
};

const detailsStyle = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  marginBottom: '0.5rem',
  opacity: 0.8,
};

const modalFooterStyle = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid var(--card-border)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '1rem',
  background: 'var(--card-bg)',
};

const buttonBaseStyle = {
  padding: '0.65rem 1.5rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  border: 'none',
};

const primaryButtonStyle = {
  ...buttonBaseStyle,
  background: 'var(--accent)',
  color: 'white',
};

const secondaryButtonStyle = {
  ...buttonBaseStyle,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--card-border)',
};

export default AuthErrorModal;
