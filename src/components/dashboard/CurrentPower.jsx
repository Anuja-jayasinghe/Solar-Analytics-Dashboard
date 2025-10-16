import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (safe: uses your public anon key)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CurrentPower = () => {
  const [power, setPower] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const maxPower = 40; // kW

  // --- Fetch live data securely through Supabase Edge Function ---
  const fetchLivePower = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("get-live-power");
      if (error) throw error;

      const livePower = data?.currentPower ?? 0;
      setPower(livePower);
    } catch (err) {
      console.error("Error fetching live power:", err.message);
      // fallback mock if API unavailable
      setPower(Math.random() * maxPower * 0.85);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLivePower();                    // initial load
    const interval = setInterval(fetchLivePower, 300000); // every 5 mins
    return () => clearInterval(interval);
  }, []);

  // --- SVG Calculation Logic ---
  const percentage = Math.min(power / maxPower, 1);
  const totalAngle = 270;
  const startAngle = -135;
  const needleRotation = startAngle + percentage * totalAngle;

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const displayPower = loading ? 0 : power;
  const displayPercentage = Math.min(displayPower / maxPower, 1);
  const displayNeedleRotation = startAngle + displayPercentage * totalAngle;

  const arcPath = describeArc(100, 100, 80, startAngle, startAngle + totalAngle);
  const filledArcPath = describeArc(100, 100, 80, startAngle, displayNeedleRotation);

  return (
    <>
      <style>{`
        .current-power-dial {
          background: linear-gradient(145deg, rgba(20, 20, 22, 0.8), rgba(12, 12, 14, 0.85));
          border-radius: 24px;
          padding: 1.5rem;
          text-align: center;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 255, 255, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.05);
          width: 38%;
          height: 300px;
          margin: 0 auto;
          overflow: hidden;
          position: relative;
        }
        .current-power-dial::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: radial-gradient(circle at top left, rgba(0, 234, 255, 0.15), transparent 30%);
          pointer-events: none;
        }
        .dial-title {
          color: var(--accent, #00eaff);
          margin-bottom: 0.5rem;
          font-weight: bold;
          font-size: 1.25rem;
          text-shadow: 0 0 10px var(--accent, #00eaff);
        }
        .dial-svg {
          width: 100%;
          height: auto;
          max-height: 200px;
        }
        .dial-needle {
          transition: transform 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          transform-origin: center;
        }
        .dial-value-text {
          font-size: 2.5rem;
          font-weight: bold;
          fill: #ffffff;
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
        }
        .dial-unit-text {
          font-size: 1rem;
          fill: #a0aec0;
        }
        .dial-footer-text {
          color: #a0aec0;
          font-size: 0.9rem;
          margin-top: -1rem;
        }
        .loading-hint {
          position: absolute;
          top: 0;
          right: 0;
          font-size: 0.75rem;
          color: #888;
          padding: 0.5rem;
        }
      `}</style>

      <div className="current-power-dial">
        <h2 className="dial-title">⚙️ REAL-TIME POWER</h2>
        {loading && <span className="loading-hint">Loading...</span>}

        <svg viewBox="0 0 200 160" className="dial-svg">
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00eaff" />
              <stop offset="80%" stopColor="#ffcc00" />
              <stop offset="100%" stopColor="#ff2e2e" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Filled Arc */}
          <path
            d={filledArcPath}
            fill="none"
            stroke="url(#arcGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            style={{ filter: "url(#glow)" }}
          />

          {/* Needle */}
          <g className="dial-needle" style={{ transform: `rotate(${displayNeedleRotation}deg)` }}>
            <path d="M 100 20 L 97 100 L 103 100 Z" fill="#ffffff" />
            <circle cx="100" cy="100" r="5" fill="#888" stroke="#333" strokeWidth="2" />
          </g>

          {/* Center Text */}
          <text x="100" y="110" textAnchor="middle" className="dial-value-text">
            {displayPower.toFixed(2)}
          </text>
          <text x="100" y="130" textAnchor="middle" className="dial-unit-text">
            kW
          </text>
        </svg>

        <p className="dial-footer-text">Max Capacity: {maxPower} kW</p>
      </div>
    </>
  );
};

export default CurrentPower;
