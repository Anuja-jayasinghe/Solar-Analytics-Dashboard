export function ChartSkeleton() {
  return (
    <div className="skeleton" style={{
      height: '320px',
      background: 'var(--card-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }} />
  );
}
export function CardSkeleton() {
  return (
    <div className="skeleton" style={{
      height: '180px',
      background: 'var(--card-bg)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)'
    }} />
  );
}
import React from 'react';

/**
 * Skeleton Loader Component
 * Shows animated placeholder while data is loading
 */
export default function SkeletonLoader({ count = 5, variant = 'user' }) {
  const getHeight = () => variant === 'user' ? '20px' : '16px';
  const getWidth = () => variant === 'user' ? '100%' : '80%';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: getHeight(),
            width: getWidth(),
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
