import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, LineChart, Line, ReferenceLine
} from "recharts";
import { useInView } from 'react-intersection-observer';
import { useData } from '../../hooks/useData';

const EnergyCharts = () => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const { energyChartsData: data, loading, errors, refreshData, selectedYear, setSelectedYear } = useData();
  const [viewMode, setViewMode] = useState('carousel'); // 'carousel' | 'chart'
  const [ruler, setRuler] = useState(() => {
    const saved = localStorage.getItem('chart_ruler_value');
    return saved ? Number(saved) : 3700;
  });
  const [showRuler, setShowRuler] = useState(() => {
    const saved = localStorage.getItem('chart_ruler_visible');
    return saved ? saved === 'true' : true;
  });

  /* Removed years useMemo */

  const clampRuler = (val) => Math.min(Math.max(val, 0), 7000);

  useEffect(() => {
    localStorage.setItem('chart_ruler_value', String(clampRuler(ruler)));
  }, [ruler]);

  useEffect(() => {
    localStorage.setItem('chart_ruler_visible', String(showRuler));
  }, [showRuler]);

  // Compute Y domain bounds based on data and ruler value
  const { yMin, yMax } = useMemo(() => {
    if (!data || data.length === 0) return { yMin: 0, yMax: Math.max(4000, ruler) };
    let maxVal = 0;
    for (const d of data) {
      maxVal = Math.max(maxVal, Number(d.inverter || 0), Number(d.ceb || 0));
    }
    const top = Math.max(maxVal, ruler);
    return { yMin: 0, yMax: Math.ceil(top * 1.1 || 1000) };
  }, [data, ruler]);
  const isLoading = loading.charts;
  const error = errors.charts;

  // --- UPDATED TOOLTIP ---
  // Now displays the detailed 'period' from the data payload
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyle}>
          <p style={tooltipLabelStyle}>Billing Period:</p>
          {/* Use the 'period' field from the payload */}
          <p style={tooltipValueStyle}>{payload[0].payload.period}</p>

          <div style={{ marginTop: '8px' }}>
            <p style={{ margin: '4px 0 0', padding: 0, color: '#00c2a8' }}>
              {`Inverter: ${payload[0].value.toFixed(2)} kWh`}
            </p>
            <p style={{ margin: '4px 0 0', padding: 0, color: '#ff7a00' }}>
              {`CEB: ${payload[1].value.toFixed(2)} kWh`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container" ref={ref}>
      <style>{keyframesCSS}</style>
      <div className="chart-header">
        <h2 style={{ margin: 0 }}>Monthly Energy Summary</h2>

        {/* Year Navigator */}
        <div style={yearNavStyle}>
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            style={navBtn}
            title="Previous Year"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>

          <span style={yearText}>{selectedYear}</span>

          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
            style={{ ...navBtn, opacity: selectedYear >= new Date().getFullYear() ? 0.3 : 1, cursor: selectedYear >= new Date().getFullYear() ? 'default' : 'pointer' }}
            title="Next Year"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        {/* Mobile View Toggle */}
        <div className="mobile-show" style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setViewMode(prev => prev === 'carousel' ? 'chart' : 'carousel')}
            style={mobileToggleBtn}
          >
            {viewMode === 'carousel' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Graph View
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                List View
              </>
            )}
          </button>
        </div>

        <div style={rulerControls} className="desktop-show">
          <label htmlFor="rulerSlider" style={rulerLabel}>Ruler</label>
          <button
            onClick={() => setShowRuler((v) => !v)}
            style={toggleBtn}
            title={showRuler ? 'Hide ruler' : 'Show ruler'}
            onMouseEnter={(e) => e.target.style.opacity = '1'}
            onMouseLeave={(e) => e.target.style.opacity = '0.6'}
          >
            {showRuler ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            )}
          </button>
          <input
            id="rulerSlider"
            type="range"
            min={0}
            max={7000}
            step={100}
            value={clampRuler(ruler)}
            onChange={(e) => setRuler(clampRuler(Number(e.target.value)))}
            style={rulerSlider}
            title="Move ruler line"
          />
          <span style={rulerValueBadge}>{`${clampRuler(ruler).toLocaleString()} kWh`}</span>
          <button
            onClick={() => setRuler(3700)}
            style={resetBtn}
            title="Reset to 3700"
          >
            Reset
          </button>
        </div>
      </div>

      {isLoading && data.length === 0 ? (
        <div style={messageContainer}>
          <div style={spinner}></div>
          <p>Loading energy data...</p>
        </div>
      ) : error && data.length === 0 ? (
        <div style={messageContainer}>
          <p style={{ color: '#f56565' }}>Failed to load data.</p>
          <button onClick={() => refreshData('charts')} style={retryButton}>Try Again</button>
        </div>
      ) : data.length === 0 ? (
        <div style={messageContainer}><p>No energy data available</p></div>
      ) : (
        <div style={{ opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.2s', position: 'relative' }}>
          {isLoading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, pointerEvents: 'none'
            }}>
              <div style={{ ...spinner, width: '30px', height: '30px', borderWidth: '2px', borderTopWidth: '2px' }}></div>
            </div>
          )}
          {/* --- MOBILE VIEW: Dynamic Content --- */}
          <div className="mobile-show">
            {viewMode === 'carousel' ? (
              <>
                <p style={swipeHintStyle}>Swipe for history &rarr;</p>
                <div style={listContainerStyle}>
                  {data.map((item, index) => (
                    <div key={index} style={listItemStyle}>
                      <div style={listItemHeader}>
                        <span style={monthBadgeStyle}>{item.month}</span>
                        <span style={periodStyle}>{item.period}</span>
                      </div>

                      <div style={listItemContent}>
                        {/* Inverter Row */}
                        <div style={dataRowStyle}>
                          <div style={labelGroup}>
                            <div style={{ ...dotStyle, background: '#00c2a8' }}></div>
                            <span style={labelStyle}>Inverter</span>
                          </div>
                          <span style={valueStyle}>{Number(item.inverter).toFixed(1)} <small>kWh</small></span>
                        </div>
                        {/* Progress Bar for Inverter */}
                        <div style={progressBg}>
                          <div style={{
                            ...progressFill,
                            background: '#00c2a8',
                            width: `${Math.min((item.inverter / yMax) * 100, 100)}%`
                          }}></div>
                        </div>

                        {/* CEB Row */}
                        <div style={{ ...dataRowStyle, marginTop: '12px' }}>
                          <div style={labelGroup}>
                            <div style={{ ...dotStyle, background: '#ff7a00' }}></div>
                            <span style={labelStyle}>CEB</span>
                          </div>
                          <span style={valueStyle}>{Number(item.ceb).toFixed(1)} <small>kWh</small></span>
                        </div>
                        {/* Progress Bar for CEB */}
                        <div style={progressBg}>
                          <div style={{
                            ...progressFill,
                            background: '#ff7a00',
                            width: `${Math.min((item.ceb / yMax) * 100, 100)}%`
                          }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Mobile Comparison Chart */
              /* Mobile Comparison Chart (Optimized) */
              <div style={{ height: '250px', width: '100%', marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(val) => val.slice(0, 3)}
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      stroke="var(--text-secondary)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      stroke="var(--text-secondary)"
                      domain={[0, 'auto']}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="inverter" fill="#00c2a8" radius={[2, 2, 0, 0]} barSize={32} />
                    <Bar dataKey="ceb" fill="#ff7a00" radius={[2, 2, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* --- DESKTOP VIEW: Charts --- */}
          <div className="desktop-show">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data} isAnimationActive={inView}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
                {/* XAxis now uses the simple 'month' label */}
                <XAxis
                  dataKey="month"
                  stroke="var(--chart-text)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={0} // No longer need to tilt
                  textAnchor="middle"
                  height={30}
                  interval={0}
                />
                <YAxis stroke="var(--chart-text)" fontSize={12} domain={[yMin, yMax]} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-color)', paddingTop: '20px', fontSize: '14px' }} iconSize={20} />
                {/* Horizontal Ruler Line */}
                {showRuler && (
                  <ReferenceLine y={clampRuler(ruler)} stroke="#22c55e" strokeDasharray="6 6" label={{ value: `${clampRuler(ruler)} kWh`, position: 'right', fill: '#22c55e' }} />
                )}
                <Bar
                  dataKey="inverter"
                  fill="#00c2a8"
                  name="Inverter (kWh)"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 194, 168, 0.3))' }}
                />
                <Bar
                  dataKey="ceb"
                  fill="#ff7a00"
                  name="CEB (kWh)"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(255, 122, 0, 0.3))' }}
                />
              </BarChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height={350} style={{ marginTop: "2rem" }}>
              <LineChart data={data} isAnimationActive={inView}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="var(--chart-grid)" />
                {/* XAxis now uses the simple 'month' label */}
                <XAxis
                  dataKey="month"
                  stroke="var(--chart-text)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={0} // No longer need to tilt
                  textAnchor="middle"
                  height={30}
                  interval={0}
                />
                <YAxis stroke="var(--chart-text)" fontSize={12} domain={[yMin, yMax]} />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-color)', paddingTop: '20px', fontSize: '14px' }} iconSize={20} />
                {/* Horizontal Ruler Line */}
                {showRuler && (
                  <ReferenceLine y={clampRuler(ruler)} stroke="#22c55e" strokeDasharray="6 6" label={{ value: `${clampRuler(ruler)} kWh`, position: 'right', fill: '#22c55e' }} />
                )}
                <Line
                  type="monotone"
                  dataKey="inverter"
                  name="Inverter (kWh)"
                  stroke="#00c2a8"
                  strokeWidth={3}
                  dot={{ fill: '#00c2a8', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#00c2a8', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
                />
                <Line
                  type="monotone"
                  dataKey="ceb"
                  name="CEB (kWh)"
                  stroke="#ff7a00"
                  strokeWidth={3}
                  dot={{ fill: '#ff7a00', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#ff7a00', strokeWidth: 2, fill: 'var(--card-bg-solid)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Styles (from your original component) ---
const yearNavStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '8px',
  padding: '4px',
  marginLeft: '1rem',
  border: '1px solid rgba(255,255,255,0.1)'
};

const navBtn = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-color)',
  padding: '4px 8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
};

const yearText = {
  fontSize: '0.9rem',
  fontWeight: '600',
  color: 'var(--text-color)',
  margin: '0 8px',
  minWidth: '40px',
  textAlign: 'center'
};

const mobileToggleBtn = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'var(--text-color)',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const rulerControls = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  justifyContent: 'center'
};
const rulerLabel = {
  fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
  color: 'var(--text-color, #ccd)',
  whiteSpace: 'nowrap'
};
const rulerSlider = {
  width: 'clamp(100px, 30vw, 160px)',
  accentColor: 'var(--accent, #00eaff)',
  touchAction: 'none'
};
const rulerValueBadge = {
  fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
  color: '#22c55e',
  background: 'rgba(34,197,94,0.1)',
  border: '1px solid rgba(34,197,94,0.3)',
  padding: '4px 8px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  minWidth: '90px',
  textAlign: 'center',
  display: 'inline-block'
};
const resetBtn = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'var(--text-color, #ccd)',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 'clamp(0.7rem, 2vw, 0.75rem)',
  minHeight: '36px'
};
const toggleBtn = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-secondary, #888)',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
  lineHeight: 1,
  minHeight: '36px',
  opacity: 0.6,
  transition: 'opacity 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const messageContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "550px",
  color: "var(--text-color, #a0aec0)",
};
const spinner = {
  width: "40px",
  height: "40px",
  border: "3px solid rgba(255,255,255,0.1)",
  borderTop: "3px solid var(--accent, #00eaff)",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: "1rem",
};
const retryButton = {
  background: "rgba(0, 234, 255, 0.2)",
  color: "var(--text-color)",
  border: "1px solid rgba(0, 234, 255, 0.4)",
  borderRadius: "6px",
  padding: "0.4rem 0.8rem",
  fontSize: "0.9rem",
  cursor: "pointer",
  marginTop: "1rem",
  transition: "all 0.2s ease",
};
const keyframesCSS = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

// --- Tooltip Styles ---
const tooltipStyle = {
  background: 'var(--card-bg-solid)',
  backdropFilter: 'blur(5px)',
  border: '1px solid var(--card-border)',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  boxShadow: '0 4px 12px var(--card-shadow)',
};
const tooltipLabelStyle = {
  margin: 0,
  padding: 0,
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  marginBottom: '4px',
};
const tooltipValueStyle = {
  margin: 0,
  padding: 0,
  fontWeight: 'bold',
  fontSize: '1rem',
  color: 'var(--text-color)',
  marginBottom: '8px',
};

// --- List View Styles (Mobile) ---
const swipeHintStyle = {
  textAlign: 'right',
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
  marginBottom: '4px',
  opacity: 0.8,
  paddingRight: '4px',
};

const listContainerStyle = {
  display: 'flex',
  flexDirection: 'row',
  gap: '12px',
  overflowX: 'auto',
  paddingBottom: '12px',
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch',
  paddingRight: '1rem',
};

const listItemStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '16px',
  minWidth: '280px',
  maxWidth: '85vw',
  scrollSnapAlign: 'start',
  flexShrink: 0,
};

const listItemHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  paddingBottom: '8px',
};

const monthBadgeStyle = {
  background: 'var(--accent)',
  color: '#000',
  fontWeight: 'bold',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '0.85rem',
};

const periodStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
};

const listItemContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const dataRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
};

const labelGroup = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const dotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
};

const labelStyle = {
  fontSize: '0.9rem',
  color: 'var(--text-color)',
};

const valueStyle = {
  fontSize: '1rem',
  fontWeight: '600',
  color: 'var(--text-color)',
};

const progressBg = {
  width: '100%',
  height: '6px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressFill = {
  height: '100%',
  borderRadius: '3px',
  transition: 'width 1s ease',
};

export default EnergyCharts;