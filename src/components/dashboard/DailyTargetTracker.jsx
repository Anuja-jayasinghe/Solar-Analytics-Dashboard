import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const SolarTracker = () => {
  const [todayGen, setTodayGen] = useState(0);
  const [target, setTarget] = useState(30);
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: latest } = await supabase
        .from("inverter_data_live")
        .select("generation_today")
        .order("data_timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: setting } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_name", "daily_generation_target")
        .single();

      const todayVal = latest?.generation_today || 0;
      const targetVal = parseFloat(setting?.setting_value || "30");
      const pct = (todayVal / targetVal) * 100;

      setTodayGen(todayVal);
      setTarget(targetVal);
      setPercent(Math.min(pct, 120));
    } catch (err) {
      console.error("Fetch error:", err);
      setTodayGen(0);
      setPercent(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const generateWavePath = (pct) => {
    const cx = 120;
    const cy = 120;
    const radius = 105;
    const fillLevel = cy + radius - (pct / 100) * (radius * 2);
    const waveHeight = 5;
    const points = [];

    for (let angle = 0; angle <= 360; angle += 3) {
      const rad = (angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius;
      const baseY = fillLevel + Math.sin(angle / 30) * waveHeight;
      if (baseY <= cy + radius) points.push(`${x},${baseY}`);
    }
    return `M${cx},${cy + radius} L${points.join(" ")} L${cx},${cy + radius} Z`;
  };

  const generateBubbles = (pct) => {
    if (pct < 10) return [];
    const num = Math.min(Math.floor(pct / 12), 8);
    const bubbles = [];
    const cx = 120;
    const cy = 120;
    const radius = 100;

    for (let i = 0; i < num; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (radius - 30);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance + 20;

      bubbles.push({
        x,
        y,
        r: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 2,
      });
    }
    return bubbles;
  };

  const displayPercent = loading ? 0 : percent;
  const displayTodayGen = loading ? 0 : todayGen;

  return (
    <div style={styles.wrapper}>
      <style>{keyframesCSS}</style>
      <div style={styles.container}>
        <div style={styles.glowOverlay} />
        <h2 style={styles.title}>☀️ Daily Generation</h2>

        <div style={styles.gaugeContainer}>
          <svg viewBox="0 0 240 240" style={styles.svg}>
            <defs>
              <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(25, 100%, 60%)" />
                <stop offset="100%" stopColor="hsl(25, 100%, 50%)" />
              </linearGradient>
              <radialGradient id="bubbleShine" cx="35%" cy="35%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id="circleClip">
                <circle cx="120" cy="120" r="105" />
              </clipPath>
            </defs>

            <circle
              cx="120"
              cy="120"
              r="110"
              stroke="rgba(0, 255, 240, 0.3)"
              strokeWidth="2"
              fill="none"
              style={{ animation: "pulse 3s ease-in-out infinite" }}
            />
            <circle
              cx="120"
              cy="120"
              r="107"
              stroke="rgba(255, 122, 0, 0.2)"
              strokeWidth="1"
              fill="none"
            />
            <circle
              cx="120"
              cy="120"
              r="105"
              fill="rgba(20, 20, 20, 0.4)"
              stroke="rgba(0, 255, 240, 0.3)"
              strokeWidth="2"
            />

            <g clipPath="url(#circleClip)">
              <path
                d={generateWavePath(displayPercent)}
                fill="url(#liquidGrad)"
                opacity="0.8"
                filter="url(#glow)"
                style={{ animation: "wave 4s ease-in-out infinite" }}
              />
              {generateBubbles(displayPercent).map((b, i) => (
                <circle
                  key={i}
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill="rgba(227, 113, 13, 0.3)"
                  style={{
                    animation: `bubble ${b.duration}s ease-in infinite`,
                    animationDelay: `${b.delay}s`,
                  }}
                />
              ))}
            </g>

            <circle
              cx="120"
              cy="120"
              r="105"
              fill="url(#bubbleShine)"
              pointerEvents="none"
            />
            <ellipse
              cx="95"
              cy="80"
              rx="35"
              ry="20"
              fill="rgba(255,255,255,0.2)"
              opacity="0.6"
            />
            <ellipse
              cx="100"
              cy="85"
              rx="20"
              ry="12"
              fill="rgba(255,255,255,0.3)"
              opacity="0.8"
            />
            <text
              x="120"
              y="115"
              textAnchor="middle"
              style={styles.percentText}
            >
              {Math.round(displayPercent)}%
            </text>
            <text
              x="120"
              y="135"
              textAnchor="middle"
              style={styles.labelText}
            >
              of Target
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
          <div
            style={{
              ...styles.progressBarInner,
              width: `${Math.min(displayPercent, 100)}%`,
            }}
          />
        </div>
        <p style={styles.progressText}>
          {displayPercent > 100
            ? "💥 Target Exceeded!"
            : `${Math.round(displayPercent)}% Completed`}
        </p>
      </div>
    </div>
  );
};

// ✅ Restored wrapper style to fix black screen
const styles = {
//   wrapper: {
//     background: "hsl(0, 0%, 2.4%)",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     padding: "24px",
//     minHeight: "100vh",
//     fontFamily:
//       '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
//   },
  container: {
    position: "relative",
    background: "rgba(20, 20, 20, 0.85)",
    backdropFilter: "blur(40px)",
    borderRadius: "24px",
    padding: "24px",
    width: "150%",
    maxWidth: "384px",
    border: "1px solid rgba(0, 255, 240, 0.2)",
    boxShadow: "0 0 25px rgba(0, 255, 240, 0.05)",
    overflow: "hidden",
  },
  glowOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(135deg, rgba(0, 255, 240, 0.05) 0%, transparent 50%, rgba(255, 122, 0, 0.05) 100%)",
    pointerEvents: "none",
  },
  title: {
    color: "hsl(180, 100%, 50%)",
    fontWeight: 700,
    fontSize: "20px",
    marginBottom: "16px",
    textAlign: "center",
    filter: "drop-shadow(0 0 12px rgba(0, 255, 240, 0.4))",
  },
  gaugeContainer: {
    position: "relative",
    width: "240px",
    height: "240px",
    margin: "0 auto 16px",
  },
  svg: { width: "100%", height: "100%" },
  percentText: {
    fontSize: "48px",
    fontWeight: 700,
    fill: "hsl(25, 100%, 50%)",
    filter: "drop-shadow(0 0 12px rgba(255, 122, 0, 0.6))",
  },
  labelText: {
    fontSize: "12px",
    fill: "hsl(180, 100%, 50%)",
    opacity: 0.8,
  },
  stats: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "12px 0",
    marginBottom: "12px",
  },
  statItem: { textAlign: "center" },
  statLabel: {
    color: "hsl(180, 100%, 50%)",
    fontSize: "10px",
    textTransform: "uppercase",
    opacity: 0.8,
    marginBottom: "4px",
    margin: 0,
  },
  statValue: {
    color: "hsl(25, 100%, 50%)",
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
  },
  unit: { fontSize: "12px", opacity: 0.7 },
  divider: { width: "1px", height: "40px", background: "rgba(255,255,255,0.1)" },
  progressBarOuter: {
    width: "100%",
    height: "6px",
    borderRadius: "3px",
    background: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    marginBottom: "8px",
  },
  progressBarInner: {
    height: "100%",
    background: "linear-gradient(90deg, hsl(25, 100%, 50%), hsl(25, 100%, 60%))",
    boxShadow: "0 0 15px rgba(255, 122, 0, 0.5)",
    transition: "width 0.6s ease",
  },
  progressText: {
    color: "hsl(180, 100%, 50%)",
    fontSize: "13px",
    opacity: 0.85,
    textAlign: "center",
    margin: 0,
  },
};

const keyframesCSS = `
  @keyframes wave {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-3px) rotate(2deg); }
  }
  @keyframes bubble {
    0% { transform: translateY(0) scale(1); opacity: 0.3; }
    50% { opacity: 0.6; }
    100% { transform: translateY(-60px) scale(0.5); opacity: 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
`;

export default SolarTracker;
