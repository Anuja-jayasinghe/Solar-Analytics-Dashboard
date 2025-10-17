import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'example-key'
);

const EarningsDifference = () => {
  const [inverterValue, setInverterValue] = useState(0);
  const [cebEarnings, setCebEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
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
        const totalInverter = invData.reduce(
          (sum, row) => sum + (row.total_generation_kwh || 0) * 50,
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

  // --- Calculations now include the descriptive text ---
  const { difference, needleRotation, differenceText } = useMemo(() => {
    if (loading || (inverterValue === 0 && cebEarnings === 0)) {
      return { difference: 0, needleRotation: 0, differenceText: '' };
    }

    const diff = inverterValue - cebEarnings;
    const maxRange = Math.max(inverterValue, cebEarnings) * 0.1 || 1;
    const clampedDiff = Math.max(-maxRange, Math.min(maxRange, diff));
    const rotation = (clampedDiff / maxRange) * 90;

    // --- NEW: Generate the descriptive text ---
    let text = '';
    const absDiffFormatted = Math.abs(diff).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

    if (diff > 0) {
      text = `Inverter value is LKR ${absDiffFormatted} higher.`;
    } else if (diff < 0) {
      text = `CEB earnings are LKR ${absDiffFormatted} higher.`;
    } else {
      text = 'The values from both sources match.';
    }

    return { difference: diff, needleRotation: rotation, differenceText: text };
  }, [inverterValue, cebEarnings, loading]);

  const differenceColor = difference >= 0 ? '#48bb78' : '#f56565';

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Earnings Variance</h2>

      {loading ? (
        <p style={styles.loadingText}>Calculating Difference...</p>
      ) : (
        <>
          <div style={styles.valuesContainer}>
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>Inverter Value</p>
              <p style={{ ...styles.valueText, color: COLORS[0] }}>
                {`LKR ${inverterValue.toLocaleString()}`}
              </p>
            </div>
            <div style={styles.valueDivider} />
            <div style={styles.valueItem}>
              <p style={styles.valueLabel}>CEB Earnings</p>
              <p style={{ ...styles.valueText, color: COLORS[1] }}>
                {`LKR ${cebEarnings.toLocaleString()}`}
              </p>
            </div>
          </div>

          <div style={styles.gaugeContainer}>
            <svg
              viewBox="0 0 200 110"
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f56565" />
                  <stop offset="50%" stopColor="#a0aec0" />
                  <stop offset="100%" stopColor="#48bb78" />
                </linearGradient>
              </defs>
              <path
                d="M 10 90 A 80 80 0 0 1 190 90"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 10 90 A 80 80 0 0 1 190 90"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <g
                style={{
                  transform: `rotate(${needleRotation}deg)`,
                  transformOrigin: 'center 90px',
                  transition: 'transform 0.7s ease-out',
                }}
              >
                <path
                  d="M 100 20 L 97 90 L 103 90 Z"
                  fill="#fff"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                />
                <circle
                  cx="100"
                  cy="90"
                  r="5"
                  fill="#a0aec0"
                  stroke="#1a1a1a"
                  strokeWidth="2"
                />
              </g>
            </svg>
          </div>

          <div style={styles.summaryContainer}>
            <p style={styles.summaryLabel}>Balance</p>
            <p style={{ ...styles.summaryValue, color: differenceColor }}>
              {difference >= 0 ? '+' : '-'} LKR{' '}
              {Math.abs(difference).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </p>
            {/* --- NEW: Descriptive text added here --- */}
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
    background:
      'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '24px',
    padding: '1.5rem',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow:
      '0 8px 32px rgba(7, 9, 9, 0.1), inset 0 1px 1px rgba(255,255,255,0.05)',
    height: '260px',
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  title: {
    color: 'var(--accent,rgb(250, 240, 240))',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    textShadow: '0 0 10px var(--accent,rgb(238, 230, 230))',
    textAlign: 'center',
    margin: '0 0 1rem 0',
  },
  loadingText: {
    color: '#a0aec0',
    textAlign: 'center',
    margin: 'auto',
  },
  valuesContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  valueItem: {
    textAlign: 'center',
  },
  valueLabel: {
    color: '#a0aec0',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    margin: '0 0 0.25rem 0',
  },
  valueText: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    margin: 0,
  },
  valueDivider: {
    width: '1px',
    height: '2.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gaugeContainer: {
    width: '100%',
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 15,
  },
  summaryContainer: {
    textAlign: 'center',
    marginTop: 'auto',
  },
  summaryLabel: {
    color: '#a0aec0',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    margin: 0,
  },
  summaryValue: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    margin: '0.25rem 0 0 0',
    textShadow: '0 0 10px currentColor',
  },
  // --- NEW: Style for the descriptive text ---
  summaryDescription: {
    color: '#a0aec0',
    fontSize: '0.75rem',
    margin: '0.25rem 0 0 0',
    height: '1.5em', // Prevents layout shift when text appears
  },
};

export default EarningsDifference;