import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const DailyTargetTracker = () => {
  const [todayGen, setTodayGen] = useState(0);
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState(0); // wave phase for smooth motion
  const [time, setTime] = useState(0);   // global time for subtle bobbing
  const [smoothPercent, setSmoothPercent] = useState(0); // eased fill percent
  const rafRef = useRef(null);

  // --- Core Data Fetching Logic (Unchanged) ---
  const fetchLiveGeneration = useCallback(async () => {
    try {
      const { data: invokeResponse, error } = await supabase.functions.invoke("solis-live-data");
      if (error) throw error;
      const liveGeneration = invokeResponse?.dailyGeneration?.value ?? 0;
      setTodayGen(liveGeneration);
      localStorage.setItem('solisDailyGen', JSON.stringify({ value: liveGeneration, timestamp: Date.now() }));
    } catch (err) {
      console.error("Error fetching live generation:", err);
    } finally {
      setLoading((prevLoading) => (prevLoading ? false : prevLoading));
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const { data: setting } = await supabase.from("system_settings").select("setting_value").eq("setting_name", "daily_generation_target").single();
        if (setting) setTarget(parseFloat(setting.setting_value));
      } catch (err) {
        console.error("Error fetching daily target:", err);
      }
      const cached = localStorage.getItem('solisDailyGen');
      if (cached) {
        const { value, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) setTodayGen(value);
      }
      await fetchLiveGeneration();
    };
    initialize();
    const interval = setInterval(fetchLiveGeneration, 300000);
    return () => clearInterval(interval);
  }, [fetchLiveGeneration]);

  // --- Calculations (Unchanged) ---
  const percent = target > 0 ? (todayGen / target) * 100 : 0;
  const targetPercent = loading && todayGen === 0 ? 0 : percent;
  const displayPercent = smoothPercent;
  const displayTodayGen = loading && todayGen === 0 ? 0 : todayGen;

  // --- Helper Functions (Unchanged) ---
  const generateWavePath = useCallback((pct, amplitude, wavelength, phaseOffset, noiseAmount = 0) => {
    const cx = 120, cy = 120, radius = 105;
    const baseFillLevel = cy + radius - (pct / 100) * (radius * 2);
    if (pct < 1) return `M ${cx - radius},${cy + radius} L ${cx + radius},${cy + radius} Z`;
    // subtle bobbing tied to time
    const bob = Math.sin(time * 0.7) * 1.5;
    const fillLevel = baseFillLevel + bob;
    const points = [];
    // lightweight pseudo-noise for organic variation
    const noise = (n) => {
      const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1; // [-1, 1]
    };
    for (let angle = 0; angle <= 360; angle += 3) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius;
      // primary wave + a subtle second harmonic for realism
      const theta = (angle / wavelength) + phaseOffset;
      const yWave = Math.sin(theta) * amplitude + Math.sin(theta * 2.2) * (amplitude * 0.35);
      const yNoise = noise(angle * 0.15 + phaseOffset) * noiseAmount;
      const y = fillLevel + yWave + yNoise;
      if (y <= cy + radius) points.push(`${x},${y}`);
    }
    return points.length > 0
      ? `M${points[0]} L${points.slice(1).join(" ")} L${cx + radius},${cy + radius} L${cx - radius},${cy + radius} Z`
      : `M ${cx - radius},${cy + radius} L ${cx + radius},${cy + radius} Z`;
  }, [time]);

  // Animation loop for wave phase and eased filling
  useEffect(() => {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // cap delta for stability
      last = now;
      // progress global time
      setTime((t) => t + dt);
      // advance phase based on time; slower when idle
      setPhase((p) => p + dt * 1.2);
      // ease smoothPercent toward targetPercent
      setSmoothPercent((current) => {
        const diff = targetPercent - current;
        const speed = 3.0; // higher = faster catch-up
        const step = diff * (1 - Math.exp(-speed * dt));
        return current + step;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetPercent]);

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
      {/* Glow overlay is now part of the main container's box-shadow */}
      
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

          <circle cx="120" cy="120" r="110" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" fill="none" style={{ animation: 'glow-pulse 3s ease-in-out infinite' }} />
          <circle cx="120" cy="120" r="107" stroke="rgba(255, 165, 0, 0.2)" strokeWidth="1" fill="none" />
          <circle cx="120" cy="120" r="105" fill="rgba(28, 30, 33, 0.4)" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" />

          <g clipPath="url(#circleClip)">
            {/* Single solid orange liquid fill */}
            <path
              d={generateWavePath(displayPercent, 8, 19, phase * 1.0, 0.4)}
              fill="#FF7A00"
              opacity="1"
            />
            {/* Bubbles removed for a fully solid orange appearance */}
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

// --- STYLES (Matched with CurrentPower.jsx) ---
const styles = {
  container: {
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px',
    padding: '1.5rem',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
    width: '38%',
    height: '300px',
    margin: '0 auto',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  title: {
    color: 'var(--accent, #00eaff)',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    textShadow: '0 0 10px var(--accent, #00eaff)',
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
    flex: '1',
  },
  statLabel: {
    color: 'var(--accent, #00eaff)', // Matched color
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    opacity: 0.8,
    marginBottom: '0.25rem',
    letterSpacing: '0.05em',
  },
  statValue: {
    color: '#ffffff', // Matched color
    fontSize: '1.125rem',
    fontWeight: '700',
  },
  unit: {
    fontSize: '0.875rem',
    color: '#a0aec0', // Matched color
  },
  divider: {
    width: '1px',
    height: '2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  @keyframes wave { 0% { transform: translateX(0px); } 50% { transform: translateX(10px); } 100% { transform: translateX(0px); } }
  @keyframes wave-alt { 0% { transform: translateX(0px); } 50% { transform: translateX(-10px); } 100% { transform: translateX(0px); } }
  @keyframes bubble { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-80px); opacity: 0; } } 
  @keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
`;

export default DailyTargetTracker;