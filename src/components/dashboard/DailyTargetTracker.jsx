import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const SolarTracker = () => {
  const [todayGen, setTodayGen] = useState(0);
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);

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
        const { data: setting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_name", "daily_generation_target")
          .single();
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

  // --- Calculations & Visuals ---
  const percent = target > 0 ? (todayGen / target) * 100 : 0;
  const displayPercent = loading && todayGen === 0 ? 0 : percent;
  const displayTodayGen = loading && todayGen === 0 ? 0 : todayGen;
  
  // --- NEW: Two wave paths for a more dynamic liquid effect ---
  const generateWavePath = (pct, amplitude, frequency) => {
    const cx = 120, cy = 120, radius = 105;
    const fillLevel = cy + radius - (pct / 100) * (radius * 2);
    if (pct < 1) return `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`; // Return a flat line at the bottom if empty

    const points = [];
    for (let angle = 0; angle <= 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius;
      const baseY = fillLevel + Math.sin(angle / frequency) * amplitude;
      if (baseY <= cy + radius) points.push(`${x},${baseY}`);
    }
    return points.length > 0 ? `M${points[0]} L${points.slice(1).join(" ")} L${cx+radius},${cy+radius} L${cx-radius},${cy+radius} Z` : `M ${cx-radius},${cy+radius} L ${cx+radius},${cy+radius} Z`;
  };

  const generateBubbles = (pct) => {
    if (pct < 10) return [];
    const num = Math.min(Math.floor(pct / 12), 8);
    return Array.from({ length: num }, () => ({
      x: 120 + (Math.random() - 0.5) * 160, y: 230,
      r: 1.5 + Math.random() * 2.5, delay: Math.random() * 4, duration: 3 + Math.random() * 3,
    }));
  };

  return (
    <div style={styles.container}>
      <style>{keyframesCSS}</style>
      <div style={styles.glowOverlay} />
      <h2 style={styles.title}>☀️ Daily Generation</h2>

      <div style={styles.gaugeContainer}>
        <svg viewBox="0 0 240 240" style={styles.svg}>
            <defs>
              <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(40, 100%, 70%)" />
                <stop offset="100%" stopColor="hsl(25, 100%, 50%)" />
              </linearGradient>
              <filter id="liquidGlow"><feGaussianBlur stdDeviation="3.5" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <clipPath id="circleClip"><circle cx="120" cy="120" r="105" /></clipPath>
            </defs>
            <circle cx="120" cy="120" r="110" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" fill="none" style={{ animation: "pulse 3s ease-in-out infinite" }} />
            <circle cx="120" cy="120" r="107" stroke="rgba(255, 122, 0, 0.2)" strokeWidth="1" fill="none" />
            <circle cx="120" cy="120" r="105" fill="rgba(20, 20, 20, 0.4)" stroke="rgba(0, 255, 240, 0.3)" strokeWidth="2" />
            
            {/* Liquid Group with Clip Path */}
            <g clipPath="url(#circleClip)">
              {/* --- NEW: Two moving wave paths --- */}
              <path d={generateWavePath(displayPercent, 6, 18)} fill="url(#liquidGrad)" opacity="0.5" filter="url(#liquidGlow)" style={{ animation: "wave 4s linear infinite" }} />
              <path d={generateWavePath(displayPercent, 7, 22)} fill="url(#liquidGrad)" opacity="0.6" filter="url(#liquidGlow)" style={{ animation: "wave2 5s linear infinite" }} />

              {generateBubbles(displayPercent).map((b, i) => (
                <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="rgba(227, 113, 13, 0.3)" style={{ animation: `bubble ${b.duration}s ease-in infinite`, animationDelay: `${b.delay}s` }} />
              ))}
            </g>

            {/* --- REMOVED: Static reflection circles/ellipses --- */}

            <text x="120" y="125" textAnchor="middle" style={styles.percentText}>{Math.round(displayPercent)}%</text>
        </svg>
      </div>

      <div style={styles.stats}>
        <div style={styles.statItem}><p style={styles.statLabel}>Generated</p><p style={styles.statValue}>{displayTodayGen.toFixed(2)} <span style={styles.unit}>kWh</span></p></div>
        <div style={styles.divider} />
        <div style={styles.statItem}><p style={styles.statLabel}>Target</p><p style={styles.statValue}>{target} <span style={styles.unit}>kWh</span></p></div>
      </div>

      <div style={styles.progressBarOuter}>
        <div style={{ ...styles.progressBarInner, width: `${Math.min(displayPercent, 100)}%`}} />
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  container: {
    position: "relative", background: "rgba(20, 20, 20, 0.85)", backdropFilter: "blur(40px)",
    borderRadius: "24px", padding: "1rem",
    border: "1px solid rgba(0, 255, 240, 0.2)", boxShadow: "0 0 25px rgba(0, 255, 240, 0.05)",
    overflow: "hidden",
    width: "38%", height: "300px", margin: "0 auto",
    display: "flex", flexDirection: "column", justifyContent: "space-around",
  },
  glowOverlay: { position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0, 255, 240, 0.05) 0%, transparent 50%, rgba(255, 122, 0, 0.05) 100%)", pointerEvents: "none" },
  title: { color: "hsl(180, 100%, 50%)", fontWeight: 700, fontSize: "20px", margin: "0", textAlign: "center", filter: "drop-shadow(0 0 12px rgba(0, 255, 240, 0.4))" },
  gaugeContainer: { position: "relative", width: "160px", height: "160px", margin: "0 auto" },
  svg: { width: "100%", height: "100%" },
  percentText: { fontSize: "36px", fontWeight: 700, fill: "hsl(25, 100%, 100%)", filter: "drop-shadow(0 0 12px rgba(255, 122, 0, 0.6))" },
  stats: { display: "flex", alignItems: "center", justifyContent: "space-around", padding: "4px 0" },
  statItem: { textAlign: "center" },
  statLabel: { color: "hsl(180, 100%, 50%)", fontSize: "10px", textTransform: "uppercase", opacity: 0.8, margin: "0 0 4px 0" },
  statValue: { color: "hsl(25, 100%, 50%)", fontSize: "18px", fontWeight: 700, margin: 0 },
  unit: { fontSize: "12px", opacity: 0.7 },
  divider: { width: "1px", height: "30px", background: "rgba(255,255,255,0.1)" },
  progressBarOuter: { width: "100%", height: "6px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.1)", overflow: "hidden" },
  progressBarInner: { height: "100%", background: "linear-gradient(90deg, hsl(35, 100%, 65%), hsl(28, 100%, 50%))", boxShadow: "0 0 18px rgba(255, 165, 0, 0.6)", transition: "width 0.6s ease" },
};

// --- NEW: Added a second wave animation for a parallax effect ---
const keyframesCSS = `
  @keyframes wave { 0% { transform: translateX(0px); } 50% { transform: translateX(10px); } 100% { transform: translateX(0px); } }
  @keyframes wave2 { 0% { transform: translateX(0px); } 50% { transform: translateX(-10px); } 100% { transform: translateX(0px); } }
  @keyframes bubble { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-80px); opacity: 0; } } 
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
`;

export default SolarTracker;