import React, { useContext } from 'react';
import { AdminThemeContext } from '../../contexts/AdminThemeContext';
import { getAdminTheme } from '../admin/adminTheme';

/**
 * High-Fidelity Retro Skeleton Loader
 * Uses the admin theme for a cohesive developer loading experience
 */
export default function SkeletonLoader({ count = 5, variant = 'table' }) {
  const context = useContext(AdminThemeContext);
  const activeTheme = context ? context.selectedTheme : 'purple';
  const presets = context ? context.adminColorPresets : {};
  const theme = getAdminTheme(presets[activeTheme]);

  const renderStatsSkeleton = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '2px',
          padding: '1rem',
          height: '100px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="skeleton-pulse" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `linear-gradient(90deg, transparent, ${theme.colors.accent}08, transparent)`,
            animation: 'skeleton-scan 2s infinite'
          }} />
          <div style={{ height: '10px', width: '60%', background: 'rgba(255,255,255,0.05)', marginBottom: '15px' }} />
          <div style={{ height: '30px', width: '40%', background: 'rgba(255,255,255,0.08)' }} />
        </div>
      ))}
    </div>
  );

  const renderTableSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: `1px solid ${theme.colors.border}`, borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '35px', background: 'rgba(255,255,255,0.03)', borderBottom: `2px solid ${theme.colors.borderStrong}` }} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: '1rem',
          padding: '12px 1rem',
          background: 'transparent',
          borderBottom: `1px solid ${theme.colors.border}`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="skeleton-pulse" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `linear-gradient(90deg, transparent, ${theme.colors.accent}04, transparent)`,
            animation: 'skeleton-scan 2.5s infinite'
          }} />
          <div style={{ flex: 2, height: '12px', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes skeleton-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      {variant === 'stats' ? renderStatsSkeleton() : renderTableSkeleton()}
    </>
  );
}

export function ChartSkeleton() {
  return (
    <div className="skeleton-box" style={{
      height: '320px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '2px',
      border: '1px solid rgba(255,255,255,0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
       {/* Simple pulse here too if needed */}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="skeleton-box" style={{
      height: '180px',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '2px',
      border: '1px solid rgba(255,255,255,0.1)'
    }} />
  );
}
