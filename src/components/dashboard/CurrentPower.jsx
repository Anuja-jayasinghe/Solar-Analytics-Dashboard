import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CurrentPower = () => {
  const [power, setPower] = useState(0);
  const [status, setStatus] = useState("Offline"); // State for online/offline status
  const [loading, setLoading] = useState(true);

  const maxPower = 40; // Max inverter power in kW

  // --- Fetch live data from Supabase Edge Function ---
  const fetchLivePower = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("solis-live-data");
      if (error) throw error;

      // Cache the new data and timestamp in localStorage
      localStorage.setItem('solisLiveData', JSON.stringify({ data, timestamp: Date.now() }));

      // Update state from the API response
      setPower(data?.currentPower?.value ?? 0);
      setStatus(data?.status ?? "Offline");

    } catch (err) {
      console.error("Error fetching live power:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const cached = localStorage.getItem('solisLiveData');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // Use cache if < 5 min old
          setPower(data?.currentPower?.value ?? 0);
          setStatus(data?.status ?? "Offline");
        }
      }
      await fetchLivePower();
    })();

    const interval = setInterval(fetchLivePower, 300000);
    return () => clearInterval(interval);
  }, []);

  // --- Visual and Dial Calculations ---
  const displayPower = power;
  const displayNeedleRotation = -135 + Math.min(displayPower / maxPower, 1) * 270;
  
  const polarToCartesian = (cx, cy, r, angle) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx, cy, r, start, end) => {
    const startPt = polarToCartesian(cx, cy, r, end);
    const endPt = polarToCartesian(cx, cy, r, start);
    const largeArc = end - start <= 180 ? "0" : "1";
    return `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArc} 0 ${endPt.x} ${endPt.y}`;
  };

  const arcPath = describeArc(100, 100, 80, -135, 135);
  const filledArcPath = describeArc(100, 100, 80, -135, displayNeedleRotation);

  const statusColor = status === "Online" ? "#00ff00" : "#ff2e2e";

  return (
    <div className="current-power-dial">
      <h2 className="dial-title">
        {/* Themed tooltip is attached to this status indicator */}
        <div 
          className="status-indicator" 
          style={{ backgroundColor: statusColor, boxShadow: `0 0 12px ${statusColor}` }}
          data-tooltip={status}
        />
        ⚡ Live Power
      </h2>
      {loading && status === "Offline" && <span className="loading-hint">Connecting...</span>}

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

        <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
        <path d={filledArcPath} fill="none" stroke="url(#arcGradient)" strokeWidth="12" strokeLinecap="round" style={{ filter: "url(#glow)" }} />
        
        <g className="dial-needle" style={{ transform: `rotate(${displayNeedleRotation}deg)` }}>
          <path d="M 100 20 L 97 100 L 103 100 Z" fill="#fff" />
          <circle cx="100" cy="100" r="5" fill="#888" stroke="#333" strokeWidth="2" />
        </g>
        
        <text x="100" y="110" textAnchor="middle" className="dial-value-text">{displayPower.toFixed(1)}</text>
        <text x="100" y="130" textAnchor="middle" className="dial-unit-text">kW</text>
      </svg>

      <p className="dial-footer-text">Max Capacity: {maxPower} kW</p>

      {/* --- STYLES --- */}
      <style>{`
        .current-power-dial {
          background: linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85));
          border-radius: 24px; padding: 1.5rem; text-align: center;
          backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05);
          width: 38%; height: 300px; margin: 0 auto; position: relative;
        }
        .dial-title { 
          color: var(--accent, #00eaff); margin-bottom: 0.5rem; font-weight: bold; font-size: 1.25rem;
          text-shadow: 0 0 10px var(--accent, #00eaff); display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .status-indicator {
          width: 12px; height: 12px; border-radius: 50%;
          animation: ${status === "Online" ? "pulse 2s infinite" : "none"};
          position: relative; /* Required to anchor the tooltip */
        }
        
        /* --- Tooltip Styles --- */
        .status-indicator::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 150%; /* Position it above the dot */
          left: 50%;
          transform: translateX(-50%);
          
          background: rgba(10, 10, 12, 0.85);
          color: #fff;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.8rem;
          white-space: nowrap;
          
          backdrop-filter: blur(5px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          
          /* Hide by default */
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
          pointer-events: none;
        }
        .status-indicator:hover::after {
          opacity: 1;
          visibility: visible;
        }
        /* --- End Tooltip Styles --- */

        @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
        .dial-svg { width: 100%; height: auto; max-height: 200px; }
        .dial-needle { transition: transform 0.7s cubic-bezier(0.68,-0.55,0.27,1.55); transform-origin: center; }
        .dial-value-text { font-size: 2.5rem; font-weight: bold; fill: #fff; text-shadow: 0 0 15px rgba(255,255,255,0.5); }
        .dial-unit-text { font-size: 1rem; fill: #a0aec0; }
        .dial-footer-text { color: #a0aec0; font-size: 0.9rem; margin-top: -1rem; }
        .loading-hint { position: absolute; top: 0; right: 0; font-size: 0.75rem; color: #888; padding: 0.5rem; }
      `}</style>
    </div>
  );
};

export default CurrentPower;