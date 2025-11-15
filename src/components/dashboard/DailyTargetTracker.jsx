import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useData } from "../../hooks/useData"; // Make sure this path is correct

// TODO: Remove this createClient and use the imported 'supabase' from your lib
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const DailyTargetTracker = () => {
  // Get all data from the central context
  const { livePowerData, loading } = useData();
  const [target, setTarget] =useState(30);

  // Fetch the static target ONCE
  useEffect(() => {
    const fetchTarget = async () => {
      try {
        const { data: setting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_name", "daily_generation_target")
          .single();
        if (setting) setTarget(parseFloat(setting.setting_value));
      } catch (err) {
        console.error("Error fetching daily target:", err);
      }
    };
    fetchTarget();
  }, []);

  // --- Calculations & Visuals ---
  // ✅ FIX: Access the nested 'value' property from the context data
  const todayGen = livePowerData?.dailyGeneration?.value || 0;

  const percent = target > 0 ? (todayGen / target) * 100 : 0;
  // Use the loading state from the context
  const displayPercent = loading.live && todayGen === 0 ? 0 : percent;
  const displayTodayGen = loading.live && todayGen === 0 ? 0 : todayGen;

  // --- Helper Functions (Unchanged) ---
  const generateWavePath = useCallback((pct, amplitude, frequency) => {
    const cx = 120, cy = 120, radius = 105;
    const fillLevel = cy + radius - (pct / 100) * (radius * 2);
    if (pct < 1) return `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`;
    const points = [];
    for (let angle = 0; angle <= 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius;
      const baseY = fillLevel + Math.sin(angle / frequency) * amplitude;
      if (baseY <= cy + radius) points.push(`${x},${baseY}`);
    }
    return points.length > 0 
      ? `M${points[0]} L${points.slice(1).join(" ")} L${cx+radius},${cy+radius} L${cx-radius},${cy+radius} Z` 
      : `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`;
  }, []);

  const bubbles = useMemo(() => {
    if (displayPercent < 10) return [];
    const num = Math.min(Math.floor(displayPercent / 12), 8);
    return Array.from({ length: num }, (_, i) => ({
      id: i,
      x: 120 + (Math.random() - 0.5) * 160, y: 230,
      r: 1.5 + Math.random() * 2.5, delay: Math.random() * 4, duration: 3 + Math.random() * 3,
    }));
  }, [displayPercent]);

  return (
    <div style={styles.container}>
      <style>{keyframesCSS}</style>
      
      <h2 style={styles.title}>☀️ Daily Generation</h2>

      <div style={styles.gaugeContainer}>
        <svg viewBox="0 0 240 240" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(40, 100%, 70%)" />
              <stop offset="100%" stopColor="hsl(25, 100%, 50%)" />
            </linearGradient>
            <filter id="liquidGlow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="circleClip"><circle cx="120" cy="120" r="105" /></clipPath>
          </defs>

          <circle cx="120" cy="120" r="110" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" fill="none" style={{ animation: 'glow-pulse 2s ease-in-out infinite' }} />
          <circle cx="120" cy="120" r="107" stroke="rgba(255, 165, 0, 0.2)" strokeWidth="1" fill="none" />
          <circle cx="120" cy="120" r="105" fill="rgba(28, 30, 33, 0.4)" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" />

          <g clipPath="url(#circleClip)">
            <path d={generateWavePath(displayPercent, 6, 18)} fill="url(#liquidGrad)" opacity="0.5" filter="url(#liquidGlow)" style={{ animation: 'wave 4s linear infinite', transition: 'all 0.6s ease' }} />
            <path d={generateWavePath(displayPercent, 7, 22)} fill="url(#liquidGrad)" opacity="0.6" filter="url(#liquidGlow)" style={{ animation: 'wave-alt 5s linear infinite', transition: 'all 0.6s ease' }} />
            {bubbles.map((bubble) => (
              <circle
                key={bubble.id} cx={bubble.x} cy={bubble.y} r={bubble.r}
                fill="hsl(25 100% 50% / 0.3)"
                style={{ animation: `bubble ${bubble.duration}s ease-in infinite`, animationDelay: `${bubble.delay}s` }}
              />
            ))}
          </g>
          
          <text x="120" y="125" textAnchor="middle" style={styles.percentText}>
            {Math.round(displayPercent)}%
          </text>
        </svg>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Generated</p>
          <p style={styles.statValue}>
            {/* ✅ This line is now safe and will not crash */}
            {displayTodayGen.toFixed(2)} <span style={styles.unit}>kWh</span>
          </p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Target</p>
          <p style={styles.statValue}>
            {target} <span style={styles.unit}>kWh</span>
          </p>
        </div>
      </div>

      <div style={styles.progressBarOuter}>
        <div style={{ ...styles.progressBarInner, width: `${Math.min(displayPercent, 100)}%` }} />
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  container: {
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px', padding: '1.5rem', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
    width: '49%', height: '400px', margin: '0 auto', position: 'relative',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
  },
  title: {
    color: 'var(--accent, #00eaff)', fontWeight: 'bold', fontSize: '2rem',
    textShadow: '0 0 10px var(--accent, #00eaff)', textAlign: 'center', margin: 0,
  },
  gaugeContainer: {
    position: 'relative', width: '160px', height: '160px', margin: '0 auto',
  },
  percentText: {
    fontSize: '2.25rem', fontWeight: '700', fill: '#ffffff',
    textShadow: '0 0 15px rgba(255,255,255,0.5)',
  },
  stats: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.25rem 0',
  },
  statItem: { textAlign: 'center', flex: '1' },
  statLabel: {
    color: 'var(--accent, #00eaff)', fontSize: '0.75rem', textTransform: 'uppercase',
    opacity: 0.8, marginBottom: '0.25rem', letterSpacing: '0.05em',
  },
  statValue: { color: '#ffffff', fontSize: '1.125rem', fontWeight: '700' },
  unit: { fontSize: '0.875rem', color: '#a0aec0' },
  divider: { width: '1px', height: '2rem', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  progressBarOuter: {
    width: '100%', height: '0.375rem', borderRadius: '9999px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundImage: 'linear-gradient(to right, hsl(35, 100%, 65%), hsl(28, 100%, 50%))',
    boxShadow: '0 0 18px rgba(255, 165, 0, 0.6)',
    transition: 'width 600ms ease-out',
  },
};

const keyframesCSS = `
  @keyframes wave { 0% { transform: translateX(0px); } 50% { transform: translateX(10px); } 100% { transform: translateX(0px); } }
  @keyframes wave-alt { 0% { transform: translateX(0px); } 50% { transform: translateX(-10px); } 100% { transform: translateX(0px); } }
  @keyframes bubble { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-80px); opacity: 0; } } 
  @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
`;

export default DailyTargetTracker;