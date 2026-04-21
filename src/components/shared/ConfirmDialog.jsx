import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import { AdminThemeContext } from '../../contexts/AdminThemeContext';
import { getAdminTheme } from '../admin/adminTheme';

/**
 * Confirmation Dialog Component
 * Centered via React Portal and themed with Retro-Developer aesthetic
 */
export default function ConfirmDialog({
  open = false,
  title = 'CONFIRM_ACTION',
  message = 'Are you sure you want to proceed?',
  confirmText = 'EXECUTE',
  cancelText = 'ABORT',
  onConfirm = () => {},
  onCancel = () => {},
  isLoading = false,
  isDangerous = false,
}) {
  const context = useContext(AdminThemeContext);
  
  // Guard for cases where context might not be available (fallback to default theme)
  const activeTheme = context ? context.selectedTheme : 'purple';
  const presets = context ? context.adminColorPresets : {};
  const theme = getAdminTheme(presets[activeTheme]);
  
  if (!open) return null;

  const dangerColor = isDangerous ? theme.colors.danger : theme.colors.accent;

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000, // Higher than most UI elements
      fontFamily: theme.fonts.mono
    }}>
      <div style={{
        backgroundColor: '#060d1a',
        border: `2px solid ${theme.colors.borderStrong}`,
        borderRadius: '2px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: `0 24px 64px rgba(0, 0, 0, 0.9), 0 0 20px ${theme.colors.accent}15`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative corner accents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '10px', height: '10px', borderTop: `2px solid ${theme.colors.accent}`, borderLeft: `2px solid ${theme.colors.accent}` }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', borderTop: `2px solid ${theme.colors.accent}`, borderRight: `2px solid ${theme.colors.accent}` }} />
        
        {/* Header/Title Bar */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDangerous ? theme.colors.danger : theme.colors.accent }} />
          <h2 style={{ 
            margin: 0, 
            fontSize: '12px', 
            color: theme.colors.accent, 
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            {title}
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 20px' }}>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            color: theme.colors.text, 
            lineHeight: '1.6',
            opacity: 0.9 
          }}>
            {message}
          </p>
        </div>

        {/* Actions Area */}
        <div style={{ 
          padding: '16px 20px', 
          background: 'rgba(0, 0, 0, 0.3)',
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end',
          borderTop: `1px solid ${theme.colors.border}`
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
            style={{
              padding: '8px 18px',
              backgroundColor: 'transparent',
              color: theme.colors.textMuted,
              border: `1px solid ${theme.colors.borderStrong}`,
              borderRadius: '2px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontSize: '11px',
              fontWeight: '700',
              fontFamily: theme.fonts.mono,
              letterSpacing: '1px',
              transition: 'all 0.2s ease'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            onMouseEnter={(e) => { e.target.style.background = `${dangerColor}33`; e.target.style.boxShadow = `0 0 12px ${dangerColor}40`; }}
            onMouseLeave={(e) => { e.target.style.background = `${dangerColor}15`; e.target.style.boxShadow = 'none'; }}
            style={{
              padding: '8px 22px',
              backgroundColor: `${dangerColor}15`,
              color: dangerColor,
              border: `1px solid ${dangerColor}`,
              borderRadius: '2px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontSize: '11px',
              fontWeight: '700',
              fontFamily: theme.fonts.mono,
              letterSpacing: '1px',
              transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? 'SYNCING...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
