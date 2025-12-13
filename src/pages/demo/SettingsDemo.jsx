import React, { Suspense, lazy, useState, useEffect } from 'react';
import { DemoDataProvider } from '../../contexts/DemoDataContext';

// Reuse the existing Settings page UI (view-only intent for demo)
const Settings = lazy(() => import('../Settings'));

export default function SettingsDemo() {
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    let timer;
    if (noticeOpen) {
      timer = setTimeout(() => setNoticeOpen(false), 2500);
    }
    return () => timer && clearTimeout(timer);
  }, [noticeOpen]);

  const handleBlockedAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setNoticeOpen(true);
  };

  return (
    <DemoDataProvider>
      <Suspense fallback={<div style={{ color: 'var(--accent)', textAlign: 'center' }}>Loading demo settings...</div>}>
        <div style={{ position: 'relative' }}>
          {/* Read-only banner */}
          <div style={{
            margin: '0.5rem 0 1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(255, 193, 7, 0.08)',
            border: '1px solid rgba(255, 193, 7, 0.25)',
            color: '#ffc107',
            textAlign: 'center'
          }}>
            ⚠️ Demo Mode — Read-only. Changes won't be saved.
          </div>

          {/* Settings UI (reused) */}
          <div style={{ position: 'relative' }}>
            <Settings />

            {/* Transparent overlay to block interactions */}
            <div
              onClick={handleBlockedAction}
              onMouseDown={handleBlockedAction}
              onKeyDown={handleBlockedAction}
              role="presentation"
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'not-allowed',
                background: 'transparent',
              }}
            />

            {/* Toast/notice */}
            {noticeOpen && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(220, 53, 69, 0.1)',
                border: '1px solid rgba(220, 53, 69, 0.35)',
                color: 'rgba(220, 53, 69, 0.95)',
                fontSize: '0.95rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
              }}>
                🚫 This is a demo account. Settings changes are not allowed.
              </div>
            )}
          </div>
        </div>
      </Suspense>
    </DemoDataProvider>
  );
}
