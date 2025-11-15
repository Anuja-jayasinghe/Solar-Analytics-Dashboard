import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useData } from "../../hooks/useData";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const DailyTargetTracker = () => {
  const { livePowerData, loading } = useData();
  const [target, setTarget] = useState();
  const [waveOffset1, setWaveOffset1] = useState(0);
  const [waveOffset2, setWaveOffset2] = useState(0);

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

  // Animate waves continuously
  useEffect(() => {
    const animate = () => {
      setWaveOffset1(prev => (prev + 0.8) % 360);
      setWaveOffset2(prev => (prev + 0.6) % 360);
    };
    const interval = setInterval(animate, 30);
    return () => clearInterval(interval);
  }, []);

  const todayGen = livePowerData?.dailyGeneration?.value || 0;
  const percent = target > 0 ? (todayGen / target) * 100 : 0;
  const displayPercent = loading.live && todayGen === 0 ? 0 : percent;
  const displayTodayGen = loading.live && todayGen === 0 ? 0 : todayGen;

  // Generate realistic wave path with multiple sine waves
  const generateRealisticWave = useCallback((pct, offset, amplitude, frequency) => {
    const cx = 120, cy = 120, radius = 105;
    const fillLevel = cy + radius - (pct / 100) * (radius * 2);
    
    if (pct < 1) return `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`;
    
    const points = [];
    const step = 2;
    
    for (let angle = -180; angle <= 180; angle += step) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius;
      
      // Multiple overlapping sine waves for realism
      const wave1 = Math.sin((angle + offset) / frequency) * amplitude;
      const wave2 = Math.sin((angle + offset * 1.5) / (frequency * 1.3)) * (amplitude * 0.6);
      const wave3 = Math.sin((angle + offset * 0.7) / (frequency * 0.8)) * (amplitude * 0.3);
      
      const y = fillLevel + wave1 + wave2 + wave3;
      
      // Only add points that are within the circle
      const distFromCenter = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      if (distFromCenter <= radius) {
        points.push(`${x},${y}`);
      }
    }
    
    if (points.length < 2) return `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`;
    
    return `M${points[0]} ${points.slice(1).map(p => `L${p}`).join(' ')} L${cx+radius},${cy+radius} L${cx-radius},${cy+radius} Z`;
  }, []);

  // Dynamic bubbles with varying speeds
  const bubbles = useMemo(() => {
    if (displayPercent < 10) return [];
    const num = Math.min(Math.floor(displayPercent / 12), 10);
    return Array.from({ length: num }, (_, i) => ({
      id: i,
      x: 90 + Math.random() * 60,
      y: 180 + Math.random() * 40,
      r: 1 + Math.random() * 2.5,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 4,
    }));
  }, [displayPercent]);

  // Surface sparkles for top of liquid
  const sparkles = useMemo(() => {
    if (displayPercent < 5) return [];
    const cy = 120;
    const radius = 105;
    const fillLevel = cy + radius - (displayPercent / 100) * (radius * 2);
    
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 80 + i * 20,
      y: fillLevel - 5,
      delay: Math.random() * 2,
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
              <stop offset="0%" stopColor="hsl(40, 100%, 75%)" />
              <stop offset="30%" stopColor="hsl(35, 100%, 65%)" />
              <stop offset="100%" stopColor="hsl(25, 100%, 50%)" />
            </linearGradient>
            
            <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.4)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </linearGradient>
            
            <filter id="liquidGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            <filter id="bubbleBlur">
              <feGaussianBlur stdDeviation="0.5" />
            </filter>
            
            <clipPath id="circleClip">
              <circle cx="120" cy="120" r="105" />
            </clipPath>
          </defs>

          {/* Outer glow rings */}
          <circle 
            cx="120" cy="120" r="110" 
            stroke="rgba(0, 255, 240, 0.3)" 
            strokeWidth="2" 
            fill="none" 
            style={{ animation: 'glow-pulse 2s ease-in-out infinite' }} 
          />
          <circle 
            cx="120" cy="120" r="107" 
            stroke="rgba(255, 165, 0, 0.2)" 
            strokeWidth="1" 
            fill="none" 
          />
          
          {/* Main container */}
          <circle 
            cx="120" cy="120" r="105" 
            fill="rgba(28, 30, 33, 0.4)" 
            stroke="rgba(0, 255, 240, 0.3)" 
            strokeWidth="2" 
          />

          <g clipPath="url(#circleClip)">
            {/* Solid base fill - covers entire filled area */}
            <rect
              x="15"
              y={120 + 105 - (displayPercent / 100) * 210}
              width="210"
              height={(displayPercent / 100) * 210}
              fill="url(#liquidGrad)"
              opacity="1"
            />
            
            {/* Base liquid layer */}
            <path 
              d={generateRealisticWave(displayPercent, waveOffset1, 4, 25)} 
              fill="url(#liquidGrad)" 
              opacity="1"
              filter="url(#liquidGlow)"
            />
            
            {/* Middle wave layer */}
            <path 
              d={generateRealisticWave(displayPercent, waveOffset2, 5, 20)} 
              fill="url(#liquidGrad)" 
              opacity="1"
              filter="url(#liquidGlow)"
            />
            
            {/* Top wave layer */}
            <path 
              d={generateRealisticWave(displayPercent, waveOffset1 * 1.3, 6, 18)} 
              fill="url(#liquidGrad)" 
              opacity="1"
              filter="url(#liquidGlow)"
            />
            
            {/* Surface shine effect */}
            {displayPercent > 5 && (
              <ellipse
                cx="120"
                cy={120 + 105 - (displayPercent / 100) * 210 - 3}
                rx="80"
                ry="8"
                fill="url(#shineGrad)"
                opacity="0.6"
                style={{ animation: 'shimmer 3s ease-in-out infinite' }}
              />
            )}
            
            {/* Bubbles */}
            {bubbles.map((bubble) => (
              <g key={bubble.id}>
                <circle
                  cx={bubble.x}
                  cy={bubble.y}
                  r={bubble.r}
                  fill="rgba(255, 255, 255, 0.4)"
                  filter="url(#bubbleBlur)"
                  style={{ 
                    animation: `bubble ${bubble.duration}s ease-in infinite`,
                    animationDelay: `${bubble.delay}s`
                  }}
                />
                <circle
                  cx={bubble.x + bubble.r * 0.3}
                  cy={bubble.y - bubble.r * 0.3}
                  r={bubble.r * 0.3}
                  fill="rgba(255, 255, 255, 0.8)"
                  style={{ 
                    animation: `bubble ${bubble.duration}s ease-in infinite`,
                    animationDelay: `${bubble.delay}s`
                  }}
                />
              </g>
            ))}
            
            {/* Surface sparkles */}
            {sparkles.map((sparkle) => (
              <circle
                key={sparkle.id}
                cx={sparkle.x}
                cy={sparkle.y}
                r="1"
                fill="rgba(255, 255, 255, 0.9)"
                style={{ 
                  animation: `sparkle 2s ease-in-out infinite`,
                  animationDelay: `${sparkle.delay}s`
                }}
              />
            ))}
          </g>
          
          {/* Percentage text */}
          <text x="120" y="125" textAnchor="middle" style={styles.percentText}>
            {Math.round(displayPercent)}%
          </text>
        </svg>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Generated</p>
          <p style={styles.statValue}>
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

const styles = {
  container: {
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px', 
    padding: '1.5rem', 
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
    width: '49%', 
    height: '370px', 
    margin: '0 auto', 
    position: 'relative',
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'space-around',
  },
  title: {
    color: 'var(--accent, #00eaff)', 
    fontWeight: 'bold', 
    fontSize: '1.5rem',
    textShadow: '0 0 10px var(--accent, #00eaff)', 
    textAlign: 'center', 
    margin: 0,
  },
  gaugeContainer: {
    position: 'relative', 
    width: '160px', 
    height: '160px', 
    margin: '0 auto',
  },
  percentText: {
    fontSize: '2.25rem', 
    fontWeight: '700', 
    fill: '#ffffff',
    textShadow: '0 0 15px rgba(255,255,255,0.5)',
  },
  stats: {
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-around', 
    padding: '0.25rem 0',
  },
  statItem: { 
    textAlign: 'center', 
    flex: '1' 
  },
  statLabel: {
    color: 'var(--accent, #00eaff)', 
    fontSize: '0.75rem', 
    textTransform: 'uppercase',
    opacity: 0.8, 
    marginBottom: '0.25rem', 
    letterSpacing: '0.05em',
  },
  statValue: { 
    color: '#ffffff', 
    fontSize: '1.125rem', 
    fontWeight: '700' 
  },
  unit: { 
    fontSize: '0.875rem', 
    color: '#a0aec0' 
  },
  divider: { 
    width: '1px', 
    height: '2rem', 
    backgroundColor: 'rgba(255, 255, 255, 0.1)' 
  },
  progressBarOuter: {
    width: '100%', 
    height: '0.375rem', 
    borderRadius: '9999px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundImage: 'linear-gradient(to right, hsl(35, 100%, 65%), hsl(28, 100%, 50%))',
    boxShadow: '0 0 18px rgba(255, 165, 0, 0.6)',
    transition: 'width 600ms ease-out',
  },
};

const keyframesCSS = `
  @keyframes bubble { 
    0% { 
      transform: translateY(0) scale(1); 
      opacity: 0; 
    } 
    10% {
      opacity: 0.8;
    }
    50% { 
      opacity: 0.6; 
    } 
    100% { 
      transform: translateY(-90px) scale(0.3); 
      opacity: 0; 
    } 
  }
  
  @keyframes glow-pulse { 
    0%, 100% { 
      opacity: 0.3; 
    } 
    50% { 
      opacity: 0.6; 
    } 
  }
  
  @keyframes shimmer {
    0%, 100% {
      opacity: 0.4;
      transform: scaleX(1);
    }
    50% {
      opacity: 0.7;
      transform: scaleX(1.1);
    }
  }
  
  @keyframes sparkle {
    0%, 100% {
      opacity: 0;
      transform: scale(0);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

export default DailyTargetTracker;