import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useData } from "../../hooks/useData";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CurrentPower = () => {
  const { livePowerData, loading } = useData();

  const power = livePowerData?.currentPower?.value || 0;
  const status = livePowerData?.status || "Offline";

  const maxPower = 40;

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

  const statusColor = status === "Online" ? "#00ff88" : "#ff2e2e";

  return (
    <div className="current-power-dial">
      <h2 className="dial-title">
        <div 
          className="status-indicator" 
          style={{ backgroundColor: statusColor, boxShadow: `0 0 12px ${statusColor}` }}
          data-tooltip={status}
        />
        ⚡ Live Power
      </h2>
      {loading.live && status === "Offline" && <span className="loading-hint">Connecting...</span>}

      <svg viewBox="0 0 200 180" className="dial-svg" >
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
          <mask id="needleMask">
            <rect x="0" y="0" width="200" height="180" fill="white" />
            <circle cx="100" cy="120" r="35" fill="black" />
          </mask>
        </defs>

        <path 
          d={arcPath} 
          fill="none" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth="12" 
          strokeLinecap="round" 
        />
        <path 
          d={filledArcPath} 
          fill="none" 
          stroke="url(#arcGradient)" 
          strokeWidth="12" 
          strokeLinecap="round" 
          style={{ 
            filter: "url(#glow)",
            transition: "d 0.7s cubic-bezier(0.68,-0.55,0.27,1.55)"
          }} 
        />
        
        <g 
          style={{ 
            transform: `rotate(${displayNeedleRotation}deg)`,
            transformOrigin: '100px 100px',
            transition: 'transform 0.7s cubic-bezier(0.68,-0.55,0.27,1.55)'
          }}
          mask="url(#needleMask)"
        >
          <path 
            d="M 100 30 L 98 100 L 102 100 Z" 
            fill="#fff"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.5))" }}
          />
          <circle cx="100" cy="100" r="6" fill="#888" stroke="#333" strokeWidth="2" />
        </g>
        
        <text x="100" y="120" textAnchor="middle" className="dial-value-text" style={{ pointerEvents: 'none' }}>{displayPower.toFixed(1)}</text>
        <text x="100" y="140" textAnchor="middle" className="dial-unit-text" style={{ pointerEvents: 'none' }}>kW</text>
      </svg>

      <p className="dial-footer-text">Max Capacity: {maxPower} kW</p>

      <style>{`
        .current-power-dial {
          background: linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85));
          border-radius: 24px; padding: 1.5rem; text-align: center;
          backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 32px rgba(0,255,255,0.1), inset 0 1px 1px rgba(255,255,255,0.05);
          width: 49%; height: 370px; margin: 0 auto; position: relative;
        }
        .dial-title { 
          color: var(--accent, #00eaff); margin-bottom: 0.5rem; font-weight: bold; font-size: 1.5rem;
          text-shadow: 0 0 10px var(--accent, #00eaff); display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .status-indicator {
          width: 10px; height: 10px; border-radius: 50%;
          animation: ${status === "Online" ? "pulse 2s infinite" : "none"};
          position: relative;
        }
        .status-indicator::after {
          content: attr(data-tooltip);
          position: absolute; bottom: 150%; left: 50%; transform: translateX(-50%);
          background: rgba(10, 10, 12, 0.85); color: #ffffffff; padding: 0.3rem 0.6rem;
          border-radius: 6px; font-size: 0.8rem; white-space: nowrap;
          backdrop-filter: blur(5px); border: 1px solid rgba(255, 255, 255, 0.1);
          opacity: 0; visibility: hidden; transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
          pointer-events: none;
        }
        .status-indicator:hover::after { opacity: 1; visibility: visible; }
        @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
        .dial-svg { width: 100%; height: auto; max-height: 270px; overflow: visible; }
        .dial-value-text { font-size: 2.8rem; font-weight: bold; fill: #fff; text-shadow: 0 0 18px rgba(255,255,255,0.6); }
        .dial-unit-text { font-size: .8rem; fill: #a0aec0; }
        .dial-footer-text { color: #a0aec0; font-size: 1.25rem; margin-top: -1.30rem; }
        .loading-hint { position: absolute; top: 0; right: 0; font-size: 0.75rem; color: #888; padding: 0.5rem; }
      `}</style>
    </div>
  );
};

export default CurrentPower;