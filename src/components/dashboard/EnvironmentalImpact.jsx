import React, { useEffect, useState, useMemo } from "react";
import { supabase } from '../../lib/supabaseClient';

const CO2_PER_KWH = 0.984; // kg
const CO2_ABSORBED_BY_TREE_10_YEARS = 220; // kg

const EnvironmentalImpact = () => {
  const [totalGeneration, setTotalGeneration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLifetimeGeneration() {
      setLoading(true);
      try {
        const demoMode = (import.meta?.env?.VITE_DEMO_TEST_MODE ?? 'false') === 'true';
        if (demoMode) {
          setTotalGeneration(28456); // kWh demo total (matches 28.456 MWh)
          return;
        }
        const { data, error } = await supabase
          .from("inverter_data_daily_summary")
          .select("total_generation_kwh");
        if (error) throw error;
        const lifetimeKwh = data.reduce((sum, row) => sum + (row.total_generation_kwh || 0), 0);
        setTotalGeneration(lifetimeKwh);
      } catch (err) {
        console.error("Error fetching lifetime generation data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLifetimeGeneration();
  }, []);

  const { co2Avoided, treesPlanted } = useMemo(() => {
    const totalCo2 = totalGeneration * CO2_PER_KWH;
    const equivalentTrees = totalCo2 / CO2_ABSORBED_BY_TREE_10_YEARS;
    return { co2Avoided: totalCo2, treesPlanted: equivalentTrees };
  }, [totalGeneration]);

  return (
    <div style={styles.container}>
      <style>{keyframesCSS}</style>
      <h2 style={styles.title}>Environmental Impact</h2>
      
      {loading ? (
        <p style={styles.loadingText}>Calculating Impact...</p>
      ) : (
        <>
          <div style={styles.iconContainer}>
            <svg style={styles.iconSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="iconGlow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#48bb78" filter="url(#iconGlow)"/>
            </svg>
          </div>
          <div style={styles.statsContainer}>
            <div style={styles.statItem}>
              <p style={styles.statValue}>
                {co2Avoided > 1000 ? (co2Avoided / 1000).toFixed(2) : co2Avoided.toFixed(1)}
                <span style={styles.unit}>{co2Avoided > 1000 ? ' tons' : ' kg'}</span>
              </p>
              <p style={styles.statLabel}>CO₂ Avoided</p>
            </div>
            <div style={styles.divider} />
            <div style={styles.statItem}>
              <p style={styles.statValue}>
                {Math.round(treesPlanted)}
                <span style={styles.unit}> trees</span>
              </p>
              <p style={styles.statLabel}>Equivalent Planted</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- STYLES ---
const styles = {
  container: {
    background: 'var(--card-bg)',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 0 20px var(--card-shadow)',
    height: '360px',
    width: '90%',
    position: 'relative',
    display: 'flex', overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: 'var(--accent)',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    textAlign: 'center',
    margin: 0,
    width: '100%',
  },
  loadingText: { color: 'var(--text-secondary)', textAlign: 'center', margin: 'auto' },
  iconContainer: { flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconSvg: { width: '72px', height: '72px', animation: 'heartbeat 5s ease-in-out infinite' },
  statsContainer: {
    width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)',
  },
  statItem: { textAlign: 'center' },
  statValue: {
    color: 'var(--accent)', fontSize: '1.25rem', fontWeight: 'bold', margin: 0,
  },
  unit: { fontSize: '1rem', opacity: 0.8, marginLeft: '0.25rem' },
  statLabel: { color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginTop: '0.25rem' },
  divider: { width: '1px', height: '2.5rem', backgroundColor: 'var(--glass-border)' },
};

const keyframesCSS = `@keyframes heartbeat { 
  0%, 100% { 
    transform: scale(1); 
    filter: brightness(1);
  } 
  25% { 
    transform: scale(1.1); 
    filter: brightness(1.2);
  }
  50% { 
    transform: scale(1.15); 
    filter: brightness(1.3);
  }
  75% { 
    transform: scale(1.05); 
    filter: brightness(1.1);
  }
}`;

export default EnvironmentalImpact;