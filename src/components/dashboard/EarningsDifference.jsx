import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../../hooks/useData'; // Make sure path is correct
import { createClient } from '@supabase/supabase-js'; // Assuming you have a client setup

// Initialize Supabase client (or import from your lib/supabaseClient.js)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'example-key'
);

const EarningsDifference = () => {
  // Get data from context
  const { livePowerData, totalEarningsData, loading } = useData();
  const [ratePerKwh, setRatePerKwh] = useState(50); // Default fallback
  const [rateLoading, setRateLoading] = useState(true);

  // Fetch the tariff rate on component mount
  useEffect(() => {
    async function fetchRate() {
      try {
        const { data: settingData, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_name', 'rate per kwh')
          .limit(1);

        if (error) throw error;
        if (settingData && settingData.length > 0) {
          setRatePerKwh(parseFloat(settingData[0].setting_value));
        }
      } catch (err) {
        console.error("Error fetching tariff:", err);
      } finally {
        setRateLoading(false);
      }
    }
    fetchRate();
  }, []);

  const { difference, needleRotation, differenceText, showWarning, inverterValue, cebEarnings } = useMemo(() => {
    const isLoading = loading.live || loading.totalEarnings || rateLoading;
    if (isLoading) {
      return { difference: 0, needleRotation: 0, differenceText: '', showWarning: false, inverterValue: 0, cebEarnings: 0 };
    }

    // Get values from context and state
    const totalGeneration = livePowerData?.totalGeneration?.value || 0;
    const calculatedInverterValue = totalGeneration * ratePerKwh;
    const calculatedCebEarnings = totalEarningsData?.total || 0;

    const diff = calculatedInverterValue - calculatedCebEarnings;
    const isWarning = calculatedCebEarnings > calculatedInverterValue;
    
    const maxRange = calculatedInverterValue * 0.1 || 1; 
    const clampedDiff = Math.max(-maxRange, Math.min(maxRange, diff));
    const rotation = (clampedDiff / maxRange) * 90;

    let text = '';
    const absDiffFormatted = Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 });

    if (isWarning) {
      text = `CEB earnings are LKR ${absDiffFormatted} higher than potential value!`;
    } else if (diff > 0) {
      text = `Potential value is LKR ${absDiffFormatted} more than earnings.`;
    } else {
      text = 'Values match perfectly.';
    }

    return { 
      difference: diff, 
      needleRotation: rotation, 
      differenceText: text,
      showWarning: isWarning,
      inverterValue: calculatedInverterValue,
      cebEarnings: calculatedCebEarnings
    };
  }, [livePowerData, totalEarningsData, loading, ratePerKwh, rateLoading]);

  const differenceColor = showWarning ? '#e53e3e' : (difference >= 0 ? '#48bb78' : '#f56565');
  const isLoading = loading.live || loading.totalEarnings || rateLoading;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Potential vs. Actual Earnings</h2>

      {isLoading ? (
        <p style={styles.loadingText}>Calculating Difference...</p>
      ) : (
        <>
          {showWarning && (
            <div style={styles.warningBox}>
              <strong>Warning:</strong> CEB earnings exceed your system's total potential value. This may indicate an accounting error.
            </div>
          )}

          <div style={styles.valuesContainer}>
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>Total Potential Value</p>
              <p style={{ ...styles.valueText, color: COLORS[0] }}>
                {`LKR ${inverterValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </p>
            </div>
            <div style={styles.valueDivider} />
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>Total Actual Earnings</p>
              <p style={{ ...styles.valueText, color: COLORS[1] }}>
                {`LKR ${cebEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </p>
            </div>
          </div>

          <div style={styles.gaugeContainer}>
            <svg viewBox="0 0 200 110" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f56565" />
                  <stop offset="50%" stopColor="#a0aec0" />
                  <stop offset="100%" stopColor="#48bb78" />
                </linearGradient>
              </defs>
              <path d="M 10 90 A 80 80 0 0 1 190 90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
              <path d="M 10 90 A 80 80 0 0 1 190 90" fill="none" stroke="url(#gaugeGradient)" strokeWidth="10" strokeLinecap="round" />
              <g style={{ transform: `rotate(${needleRotation}deg)`, transformOrigin: 'center 90px', transition: 'transform 0.7s ease-out' }}>
                <path d="M 100 20 L 97 90 L 103 90 Z" fill="#fff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                <circle cx="100" cy="90" r="5" fill="#a0aec0" stroke="#1a1a1a" strokeWidth="2" />
              </g>
            </svg>
          </div>

          <div style={styles.summaryContainer}>
            <p style={styles.summaryLabel}>Difference</p>
            <p style={{ ...styles.summaryValue, color: differenceColor }}>
              {difference >= 0 ? '+' : '-'} LKR{' '}
              {Math.abs(difference).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p style={styles.summaryDescription}>{differenceText}</p>
          </div>
        </>
      )}
    </div>
  );
};

// --- STYLES ---
const COLORS = ['#ffcc00', '#00eaff'];
const styles = {
  container: {
    background: 'var(--card-bg)',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 0 20px var(--card-shadow)',
    height: '360px',
    width: '90%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  title: {
    color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.1rem',
    textAlign: 'center', margin: '0 0 1rem 0',
  },
  loadingText: { color: '#a0aec0', textAlign: 'center', margin: 'auto' },
  valuesContainer: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  valueItem: { textAlign: 'center' },
  valueLabel: {
    color: '#a0aec0', fontSize: '0.75rem', textTransform: 'uppercase', margin: '0 0 0.25rem 0',
  },
  valueText: { fontSize: '1.125rem', fontWeight: 'bold', margin: 0 },
  valueDivider: { width: '1px', height: '2.5rem', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  gaugeContainer: {
    width: '100%', height: '110px', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', paddingTop: 8,
  },
  summaryContainer: { textAlign: 'center', marginTop: 'auto' },
  summaryLabel: { color: '#a0aec0', fontSize: '0.8rem', textTransform: 'uppercase', margin: 0 },
  summaryValue: {
    fontSize: '1.75rem', fontWeight: 'bold', margin: '0.25rem 0 0 0', textShadow: '0 0 10px currentColor',
  },
  summaryDescription: {
    color: '#a0aec0', fontSize: '0.75rem', margin: '0.25rem 0 0 0', minHeight: '1.5em',
  },
  warningBox: {
    background: 'rgba(229, 62, 62, 0.1)',
    border: '1px solid rgba(229, 62, 62, 0.4)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#fed7d7',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  }
};

export default EarningsDifference;