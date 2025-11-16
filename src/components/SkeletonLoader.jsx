import React from 'react';

const SkeletonLoader = ({ width = '100%', height = '20px', borderRadius = '4px', style = {} }) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export const CardSkeleton = () => (
  <div style={{
    flex: 1,
    padding: '1.2rem',
    borderRadius: '14px',
    background: 'var(--card-bg-solid)',
    border: '1px solid var(--card-border)',
    boxShadow: '0 8px 28px var(--card-shadow)',
    backdropFilter: 'blur(12px)',
    minWidth: '200px'
  }}>
    <SkeletonLoader width="60%" height="18px" style={{ marginBottom: '0.8rem' }} />
    <SkeletonLoader width="80%" height="28px" />
  </div>
);

export const ChartSkeleton = () => (
  <div style={{
    background: 'var(--card-bg)',
    borderRadius: '24px',
    padding: '1.5rem',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  }}>
    <SkeletonLoader width="200px" height="24px" />
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
      {[40, 60, 55, 70, 45, 80].map((h, i) => (
        <SkeletonLoader key={i} width="100%" height={`${h}%`} />
      ))}
    </div>
  </div>
);

export const DialSkeleton = () => (
  <div style={{
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px',
    padding: '1.5rem',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1)',
    width: '49%',
    height: '370px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  }}>
    <SkeletonLoader width="150px" height="22px" />
    <SkeletonLoader width="200px" height="200px" borderRadius="50%" style={{ marginTop: '2rem' }} />
    <SkeletonLoader width="120px" height="18px" />
  </div>
);

export default SkeletonLoader;
