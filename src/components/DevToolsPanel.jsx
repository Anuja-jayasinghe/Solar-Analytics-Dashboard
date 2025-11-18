import React, { useEffect, useMemo, useState, useRef } from 'react';
import { cacheService } from '../lib/cacheService';
import { useData } from '../hooks/useData';

const DevToolsPanel = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('cache'); // 'cache' | 'context'
  const [cacheStats, setCacheStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const context = useData();
  const panelRef = useRef(null);

  const refreshStats = () => {
    setRefreshing(true);
    setCacheStats(cacheService.getStats());
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 5000);
    return () => clearInterval(id);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const formatTime = (seconds) => {
    if (seconds == null) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const formattedLastUpdate = useMemo(() => {
    const result = {};
    Object.entries(context.lastUpdate || {}).forEach(([k, ts]) => {
      if (!ts) { result[k] = 'Never'; return; }
      const seconds = Math.floor((Date.now() - ts) / 1000);
      result[k] = formatTime(seconds);
    });
    return result;
  }, [context.lastUpdate]);

  return (
    <>
      {open && (
        <>
          <style>{`
            @media (max-width: 768px) {
              .devtools-panel {
                top: 70px !important;
                right: 10px !important;
                left: 10px !important;
                width: calc(100vw - 20px) !important;
                max-height: calc(100vh - 90px) !important;
              }
            }
          `}</style>
          <div ref={panelRef} className="devtools-panel" style={panelStyle}>
          {/* Header with tabs */}
          <div style={headerStyle}>
            <div style={tabsStyle}>
              <button
                onClick={() => setActiveTab('cache')}
                style={{ ...tabButtonStyle, ...(activeTab==='cache'?tabActiveStyle:{} ) }}
              >
                Cache
              </button>
              <button
                onClick={() => setActiveTab('context')}
                style={{ ...tabButtonStyle, ...(activeTab==='context'?tabActiveStyle:{} ) }}
              >
                Context
              </button>
            </div>
            <div style={headerActionsStyle}>
              <button 
                style={{...headerBtn, ...(refreshing ? refreshingStyle : {})}} 
                onClick={refreshStats}
                disabled={refreshing}
                title="Refresh cache stats"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6m12-4a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
              </button>
              <button style={headerBtn} onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {activeTab === 'cache' && (
              <CacheTab stats={cacheStats} formatTime={formatTime} />
            )}
            {activeTab === 'context' && (
              <ContextTab context={context} formattedLastUpdate={formattedLastUpdate} />
            )}
          </div>
          </div>
        </>
      )}
    </>
  );
};

const CacheTab = ({ stats, formatTime }) => {
  if (!stats) return <div style={emptyState}>No cache stats</div>;
  return (
    <div>
      <div style={metricsGrid}>
        <Metric label="Total Entries" value={stats.totalSize} sub={`${stats.memorySize} mem · ${stats.localStorageSize} storage`} />
        <Metric label="Cache Size" value={`${stats.totalKB} KB`} sub={`${stats.totalMB} MB`} />
        <Metric 
          label="Hit Rate" 
          value={stats.hitRate} 
          sub={`${stats.hits} hits · ${stats.misses} misses`} 
          highlight 
          title="Cache efficiency - percentage of requests served from cache. Higher is better (target: >70%)"
        />
        <Metric 
          label="Ops" 
          value={stats.sets} 
          sub={`${stats.deletes} del · ${stats.evictions} evict`}
          title="Total cache write operations"
        />
      </div>

      <h4 style={sectionTitle}>Entries</h4>
      <div style={entriesList}>
        {(stats.entries || []).map((e, i) => (
          <div key={i} style={entryRow}>
            <div style={entryName}>{e.key} {e.expired && <span style={expiredBadge}>EXPIRED</span>}</div>
            <div style={entryDetails}>
              <span>{(e.bytes/1024).toFixed(2)} KB</span>
              <span>Age {formatTime(e.age)}</span>
              <span>TTL {e.ttl>0?formatTime(e.ttl):'Expired'}</span>
            </div>
          </div>
        ))}
        {(stats.entries || []).length === 0 && (
          <div style={emptyState}>No entries</div>
        )}
      </div>
    </div>
  );
};

const ContextTab = ({ context, formattedLastUpdate }) => {
  const { loading, errors, livePowerData, monthlyGenerationData, totalEarningsData, energyChartsData, inverterPotentialValue, isStale } = context;
  return (
    <div>
      <h4 style={sectionTitle}>Loading</h4>
      <div style={stateList}>
        {Object.entries(loading).map(([k,v]) => (
          <div key={k} style={stateRow}><Dot color={v? '#f59e0b':'#22c55e'} /> <strong style={stateKey}>{k}</strong> <span style={stateVal}>{v?'Loading':'Ready'}</span></div>
        ))}
      </div>

      <h4 style={sectionTitle}>Errors</h4>
      <div style={stateList}>
        {Object.entries(errors).map(([k,err]) => (
          <div key={k} style={stateRow}><Dot color={err? '#ff4444':'#22c55e'} /> <strong style={stateKey}>{k}</strong> <span style={stateVal}>{err? (typeof err==='object'? `${err.type}`: String(err)):'None'}</span></div>
        ))}
      </div>

      <h4 style={sectionTitle}>Last Update</h4>
      <div style={stateList}>
        {Object.entries(formattedLastUpdate).map(([k,val]) => (
          <div key={k} style={stateRow}><Dot color={'#a0aec0'} /> <strong style={stateKey}>{k}</strong> <span style={stateVal}>{val}</span></div>
        ))}
      </div>

      <h4 style={sectionTitle}>Summary</h4>
      <div style={stateList}>
        <div style={stateRow}><strong style={stateKey}>Live</strong> <span style={stateVal}>{livePowerData?.currentPower?.value || 0} kW</span></div>
        <div style={stateRow}><strong style={stateKey}>MonthlyGen</strong> <span style={stateVal}>{(((monthlyGenerationData?.total ?? 0))).toFixed ? ((monthlyGenerationData?.total ?? 0)).toFixed(2) : (monthlyGenerationData?.total ?? 0)} kWh</span></div>
        <div style={stateRow}><strong style={stateKey}>Earnings</strong> <span style={stateVal}>LKR {((totalEarningsData?.total ?? 0)).toLocaleString ? ((totalEarningsData?.total ?? 0)).toLocaleString() : (totalEarningsData?.total ?? 0)}</span></div>
        <div style={stateRow}><strong style={stateKey}>Charts</strong> <span style={stateVal}>{energyChartsData?.length ?? 0} entries</span></div>
        <div style={stateRow}><strong style={stateKey}>Inverter Value</strong> <span style={stateVal}>LKR {((inverterPotentialValue?.total ?? 0)).toLocaleString ? ((inverterPotentialValue?.total ?? 0)).toLocaleString() : (inverterPotentialValue?.total ?? 0)}</span></div>
        <div style={stateRow}><strong style={stateKey}>isStale</strong> <span style={stateVal}>{isStale? 'Yes':'No'}</span></div>
      </div>
    </div>
  );
};

// Small helpers
const Metric = ({ label, value, sub, highlight, title }) => (
  <div 
    style={{...metricCard, borderColor: highlight? 'var(--success-color)': 'var(--card-border)'}}
    title={title}
  >
    <div style={metricLabel}>{label}</div>
    <div style={metricValue}>{value}</div>
    <div style={metricSub}>{sub}</div>
  </div>
);

const Dot = ({ color }) => <span style={{...dot, background: color}} />

// Styles
const panelStyle = {
  position: 'fixed',
  top: '80px',
  left: '80px',
  width: 'min(520px, calc(100vw - 120px))',
  maxHeight: 'calc(100vh - 120px)',
  overflowY: 'auto',
  zIndex: 9996,
  background: 'rgba(20,20,22,0.95)',
  border: '1px solid var(--glass-border)',
  borderRadius: '12px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(12px)',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: '1px solid var(--glass-border)'
};

const tabsStyle = { display: 'flex', gap: '6px' };
const tabButtonStyle = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--glass-border)',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer'
};
const tabActiveStyle = {
  background: 'var(--accent)',
  color: '#fff',
  borderColor: 'var(--accent)'
};

const headerActionsStyle = { display: 'flex', gap: '6px' };
const headerBtn = { background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const refreshingStyle = { animation: 'spin 1s linear infinite', background: 'transparent', color: 'var(--accent)', border: 'none' };

const bodyStyle = { padding: '12px' };

const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' };
const metricCard = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' };
const metricLabel = { fontSize: '0.75rem', color: 'var(--text-secondary)' };
const metricValue = { fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' };
const metricSub = { fontSize: '0.75rem', color: 'var(--text-muted)' };

const sectionTitle = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0' };
const entriesList = { maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' };
const entryRow = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px' };
const entryName = { fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' };
const expiredBadge = { fontSize: '0.7rem', color: '#ff4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', padding: '0 6px', borderRadius: '4px' };
const entryDetails = { display: 'flex', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' };

const stateList = { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' };
const stateRow = { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '6px' };
const stateKey = { minWidth: '110px' };
const stateVal = { color: 'var(--text-secondary)', fontSize: '0.85rem' };
const dot = { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' };

const emptyState = { textAlign: 'center', color: 'var(--text-muted)', padding: '12px' };

export default DevToolsPanel;
