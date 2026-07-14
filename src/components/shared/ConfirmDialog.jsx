import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Confirmation Dialog Component
 * Centered via React Portal, styled to match the app's public design system
 */
export default function ConfirmDialog({
  open = false,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm = () => {},
  onCancel = () => {},
  isLoading = false,
  isDangerous = false,
}) {
  if (!open) return null;

  const actionColor = isDangerous ? 'var(--error-color)' : 'var(--accent)';

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'var(--card-bg-solid)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 8px 32px var(--card-shadow)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-color)'
          }}>
            {title}
          </h2>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6'
          }}>
            {message}
          </p>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          background: 'rgba(0, 0, 0, 0.15)',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          borderTop: '1px solid var(--border-color)'
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '8px 18px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '8px 22px',
              backgroundColor: actionColor,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? 'Working...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
