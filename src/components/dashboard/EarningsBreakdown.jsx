import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (from your original file)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'example-key'
);

const EarningsDifference = () => {
  const [inverterValue, setInverterValue] = useState(0);
  const [cebEarnings, setCebEarnings] = useState(0);
  const [ratePerKwh, setRatePerKwh] = useState(50); // Default fallback
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch the rate per kWh from settings
        const { data: rateData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_name', 'rate_per_kwh')
          .single();

        if (rateData?.setting_value) {
          setRatePerKwh(parseFloat(rateData.setting_value));
        }

        // Fetch CEB and inverter data
        const { data: cebData } = await supabase
          .from('ceb_data')
          .select('earnings');
        const { data: invData } = await supabase
          .from('inverter_data_daily_summary')
          .select('total_generation_kwh');

        const totalCEB = cebData.reduce(
          (sum, row) => sum + (row.earnings || 0),
          0
        );
        
        // Use the rate from settings instead of hardcoded value
        const currentRate = rateData?.setting_value ? parseFloat(rateData.setting_value) : 50;
        const totalInverter = invData.reduce(
          (sum, row) => sum + (row.total_generation_kwh || 0) * currentRate,
          0
        );

        setInverterValue(totalInverter);
        setCebEarnings(totalCEB);
      } catch (err) {
        console.error('Error fetching earnings data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const { difference, needleRotation, differenceText, status } = useMemo(() => {
    if (loading || (inverterValue === 0 && cebEarnings === 0)) {
      return {
        difference: 0,
        needleRotation: 0,
        differenceText: '',
        status: 'neutral',
      };
    }

    const diff = inverterValue - cebEarnings;
    const maxRange = Math.max(inverterValue, cebEarnings) * 0.15 || 1;
    const clampedDiff = Math.max(-maxRange, Math.min(maxRange, diff));
    const rotation = (clampedDiff / maxRange) * 90;

    let text = '';
    let status = 'neutral';
    const absDiffFormatted = Math.abs(diff).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

    if (diff > 50) { // Using a small threshold to avoid showing for tiny differences
      text = `Inverter earning is LKR ${absDiffFormatted} higher`;
      status = 'higher';
    } else if (diff < -50) {
      text = `CEB earning is LKR ${absDiffFormatted} higher`;
      status = 'lower';
    } else {
      text = '✓ Earnings from both sources match';
      status = 'match';
    }

    return { difference: diff, needleRotation: rotation, differenceText: text, status };
  }, [inverterValue, cebEarnings, loading]);

  const differenceColor = status === 'higher' ? 'var(--accent-secondary)' : status === 'lower' ? 'var(--error-color)' : 'var(--text-secondary)';

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Earnings Variance</h2>

      {loading ? (
        <p style={styles.loadingText}>Calculating Difference...</p>
      ) : (
        <>
          <div style={styles.valuesContainer}>
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>Inverter</p>
              <p style={{ ...styles.valueText, color: 'var(--accent-secondary)' }}>
                {`LKR ${inverterValue.toLocaleString()}`}
              </p>
              <p style={{ ...styles.rateLabel, color: 'var(--text-muted)' }}>
                @ {ratePerKwh} LKR/kWh
              </p>
            </div>
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>CEB</p>
              <p style={{ ...styles.valueText, color: 'var(--accent)' }}>
                {`LKR ${cebEarnings.toLocaleString()}`}
              </p>
            </div>
          </div>

          <div style={styles.gaugeContainer}>
            <svg viewBox="0 0 200 110" style={{ width: '100%', height: '100%', maxHeight: '90px' }}>
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--error-color)" />
                  <stop offset="50%" stopColor="var(--text-secondary)" />
                  <stop offset="100%" stopColor="var(--accent-secondary)" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M 15 90 A 75 75 0 0 1 185 90"
                fill="none"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M 15 90 A 75 75 0 0 1 185 90"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="7"
                strokeLinecap="round"
                filter="url(#glow)"
              />
              <g style={{ transform: `rotate(${needleRotation}deg)`, transformOrigin: '100px 90px', transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <path
                  d="M 100 30 L 97 90 L 103 90 Z"
                  fill="var(--text-color)"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))' }}
                />
                <circle
                  cx="100"
                  cy="90"
                  r="5"
                  fill="var(--text-secondary)"
                  stroke="var(--bg-color)"
                  strokeWidth="1.5"
                />
              </g>
              <text x="100" y="55" fontSize="16" fontWeight="700" fill={differenceColor} textAnchor="middle" style={{ textShadow: `0 0 8px ${differenceColor}60` }}>
                {Math.abs(difference).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </text>
              <text x="100" y="70" fontSize="9" fill="var(--text-secondary)" textAnchor="middle" opacity="0.7">
                LKR
              </text>
              <text x="15" y="105" fontSize="9" fill="var(--text-secondary)" opacity="0.7" fontWeight="500">
                CEB ↓
              </text>
              <text x="185" y="105" fontSize="9" fill="var(--text-secondary)" opacity="0.7" textAnchor="end" fontWeight="500">
                ↑ Inverter
              </text>
            </svg>
          </div>

          <div style={styles.summaryContainer}>
             <p style={styles.summaryDescription}>{differenceText}</p>
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
    height: '260px',
    width: '90%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  title: {
    color: 'var(--accent)',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    textAlign: 'center',
    margin: 0,
    width: '100%',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: 'auto',
    fontSize: '14px',
  },
  valuesContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  valueItem: {
    flex: 1,
    textAlign: 'center',
    background: 'var(--card-bg-solid)',
    padding: '10px 8px',
    borderRadius: '10px',
    border: '1px solid var(--glass-border)',
  },
  valueLabel: {
    color: 'var(--text-secondary)',
    fontSize: '10px',
    textTransform: 'uppercase',
    margin: '0 0 4px 0',
    fontWeight: '600',
    letterSpacing: '0.2px',
  },
  valueText: {
    fontSize: '15px',
    fontWeight: '700',
    margin: 0,
  },
  rateLabel: {
    fontSize: '9px',
    fontWeight: '500',
    margin: '2px 0 0 0',
    opacity: 0.8,
  },
  gaugeContainer: {
    width: '100%',
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80px',
    maxHeight: '100px',
  },
  summaryContainer: {
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: '12px'
  },
  summaryDescription: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    margin: '0',
    fontWeight: '500',
    height: '1.5em', // Prevents layout shift
  },
};

export default EarningsDifference;