import React, { useEffect, useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from "../../lib/supabaseClient";

const SystemTrends = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState("");
  const [daysInPeriod, setDaysInPeriod] = useState(0);
  const [showXAxisLabels, setShowXAxisLabels] = useState(false);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      try {
        const demoMode = (import.meta?.env?.VITE_DEMO_TEST_MODE ?? 'false') === 'true';
        if (demoMode) {
          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() - 26); // Nov 5 to Dec 1 = 27 days
          const formatISO = (d) => d.toISOString().split('T')[0];
          const formatShort = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

          const demoRows = [];
          // Generate realistic daily patterns: higher in mid-month, varies by weather
          for (let i = 0; i <= 26; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            // Simulate seasonal variation + random weather (20-45 kWh typical range)
            const baseGen = 28 + Math.sin(i / 27 * Math.PI) * 8; // Peak mid-period
            const weatherVariation = (Math.random() - 0.3) * 10; // Random clouds/sun
            const gen = Math.max(18, Math.min(45, baseGen + weatherVariation));
            // Peak power proportional to generation (2.5-5.5 kW)
            const peak = 2.8 + (gen / 35) * 2.2 + (Math.random() - 0.5) * 0.8;
            demoRows.push({
              summary_date: formatISO(d),
              date: d.toLocaleDateString('en-GB', { day: '2-digit' }),
              fullDate: formatShort(d),
              daily_generation_kwh: Number(gen.toFixed(2)),
              peak_power_kw: Number(peak.toFixed(2)),
            });
          }

          const billStart = new Date(start);
          const formatLong = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          setBillingPeriod(`${formatLong(billStart)} – ${formatLong(today)}`);
          setDaysInPeriod(27);
          setChartData(demoRows);
          return;
        }
        // Fetch latest CEB bill date to determine billing period start
        const { data: latestBill, error: billError } = await supabase
          .from('ceb_data')
          .select('bill_date')
          .order('bill_date', { ascending: false })
          .limit(1)
          .single();
        
        const today = new Date();
        let startDate, endDate;
        
        if (latestBill && !billError) {
          // Use latest CEB bill date as start of billing period
          const billDate = new Date(latestBill.bill_date);
          startDate = billDate.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          
          const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          setBillingPeriod(`${formatDate(billDate)} – ${formatDate(today)}`);
          
          // Calculate days in period
          const diffTime = Math.abs(today - billDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          setDaysInPeriod(diffDays);
        } else {
          // Fallback to first-of-month if no CEB bill found
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          setBillingPeriod(today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
          setDaysInPeriod(today.getDate());
        }

        // Fetch daily summaries for billing period
        console.log(`[SystemTrends] Fetching data from ${startDate} to ${endDate}`);
        const { data, error } = await supabase
          .from("inverter_data_daily_summary")
          .select("summary_date, total_generation_kwh, peak_power_kw")
          .gte('summary_date', startDate)
          .lte('summary_date', endDate)
          .order("summary_date", { ascending: true });

        if (error) throw error;
        
        console.log(`[SystemTrends] Fetched ${data?.length || 0} rows from database`);
        
        // Aggregate by date (in case of multiple inverters)
        const aggregatedData = {};
        data.forEach(row => {
          const date = row.summary_date;
          if (!aggregatedData[date]) {
            aggregatedData[date] = { generation: 0, peakPower: 0 };
          }
          aggregatedData[date].generation += row.total_generation_kwh || 0;
          // Use max peak power if multiple inverters
          aggregatedData[date].peakPower = Math.max(aggregatedData[date].peakPower, row.peak_power_kw || 0);
        });

        // Format for chart
        const formattedData = Object.keys(aggregatedData).map(date => ({
          summary_date: date,
          date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit' }),
          fullDate: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          daily_generation_kwh: aggregatedData[date].generation,
          peak_power_kw: aggregatedData[date].peakPower,
        }));

        console.log(`[SystemTrends] Chart will display ${formattedData.length} days`);
        setChartData(formattedData);
      } catch (err) {
        console.error("Error fetching trend data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, []);

  // Calculate billing period stats
  const { totalGeneration, dailyAverage, bestDay, maxPeak } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalGeneration: 0, dailyAverage: 0, bestDay: { value: 0, date: '' }, maxPeak: { value: 0, date: '' } };
    }
    
    const total = chartData.reduce((sum, d) => sum + (d.daily_generation_kwh || 0), 0);
    const average = chartData.length > 0 ? total / chartData.length : 0;
    
    const best = chartData.reduce((max, d) => {
      return (d.daily_generation_kwh || 0) > max.value 
        ? { value: d.daily_generation_kwh, date: d.fullDate }
        : max;
    }, { value: 0, date: '' });
    
    const peak = chartData.reduce((max, d) => {
      return (d.peak_power_kw || 0) > max.value
        ? { value: d.peak_power_kw, date: d.fullDate }
        : max;
    }, { value: 0, date: '' });
    
    return { 
      totalGeneration: total, 
      dailyAverage: average, 
      bestDay: best,
      maxPeak: peak
    };
  }, [chartData]);

  // Custom Tooltip for the chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={styles.tooltip}>
          <p style={{ margin: 0, padding: 0, color: 'var(--text-secondary)', fontWeight: 'bold' }}>
            {data.fullDate}
          </p>
          <p style={{ margin: '4px 0 2px', padding: 0, color: 'var(--accent)' }}>
            Generation: {Number(data.daily_generation_kwh || 0).toFixed(2)} kWh
          </p>
          <p style={{ margin: '2px 0 0', padding: 0, color: '#4CAF50' }}>
            Peak Power: {Number(data.peak_power_kw || 0).toFixed(2)} kW
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container" style={styles.container}>
      <div style={styles.headerContainer}>
        <h2 style={styles.title}>Billing Period Generation</h2>
        {billingPeriod && (
          <p style={styles.subtitle}>
            {billingPeriod} {daysInPeriod > 0 && `(${daysInPeriod} days)`}
          </p>
        )}
      </div>
      <div 
        style={styles.chartContainer}
        onMouseEnter={() => setShowXAxisLabels(true)}
        onMouseLeave={() => setShowXAxisLabels(false)}
      >
        {loading && <p style={styles.loadingText}>Loading generation data...</p>}
        {!loading && chartData.length === 0 && (
          <p style={styles.loadingText}>No data available for this billing period</p>
        )}
        {!loading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart 
              data={chartData} 
              margin={{ top: 20, right: 12, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="generationFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.6} />
                  <stop offset="90%" stopColor="var(--accent)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                stroke="var(--chart-text)"
                fontSize={7}
                tickLine={false}
                axisLine={false}
                height={30}
                interval={0}
                angle={0}
                textAnchor="end"
                dy={15}
                tickFormatter={(value) => {
                  const dayNum = parseInt(value, 10);
                  const show = showXAxisLabels && dayNum % 3 === 0;
                  return show ? value : '';
                }}
                style={{fill:'var(--accent)'}}
              />
              <YAxis
                stroke="var(--accent)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={45}
              label={{ value: 'kW/kWh', angle: -90, position: 'insideLeft', offset: 5, style: { fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 'bold' } }}
              />
              <Legend 
                verticalAlign="top" 
                height={20} 
                formatter={(value) => {
                  if (value === 'daily_generation_kwh') return 'Generation (kWh)';
                  if (value === 'peak_power_kw') return 'Peak Power (kW)';
                  return value;
                }}
                wrapperStyle={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }} />
              <Area 
                type="monotone" 
                dataKey="daily_generation_kwh" 
                stroke="var(--accent)" 
                strokeWidth={2}
                fill="url(#generationFill)"
                activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 1 }}
              />
              <Area 
                type="monotone"
                dataKey="peak_power_kw"
                stroke="#4CAF50"
                strokeWidth={1.5}
                fill="none"
                activeDot={{ r: 4, stroke: '#4CAF50', strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Billing Period Stats Section */}
      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Total</p>
          <p style={styles.statValue}>{Number(totalGeneration || 0).toFixed(1)} <span style={styles.unit}>kWh</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Daily Avg</p>
          <p style={styles.statValue}>{Number(dailyAverage || 0).toFixed(1)} <span style={styles.unit}>kWh</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Max Peak</p>
          <p style={styles.statValue}>{Number(maxPeak?.value || 0).toFixed(2)} <span style={styles.unit}>kW</span></p>
          {maxPeak.date && <p style={styles.bestDayDate}>{maxPeak.date}</p>}
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Best Day</p>
          <p style={styles.statValue}>{Number(bestDay?.value || 0).toFixed(1)} <span style={styles.unit}>kWh</span></p>
          {bestDay.date && <p style={styles.bestDayDate}>{bestDay.date}</p>}
        </div>
      </div>
    </div>
  );
};

// --- STYLES (Matched with other dashboard components) ---
const styles = {
  container: {
    background: 'var(--card-bg)',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 0 20px var(--card-shadow)',
    height: '360px',
    width: '90%',
    margin: 0,
    display: 'flex', 
    overflow: 'hidden',
    flexDirection: 'column',
  },
  headerContainer: {
    textAlign: 'center',
    marginBottom: '0.5rem',
  },
  title: {
    color: 'var(--accent)',
    fontWeight: 'bold',
    fontSize: '1.25rem',
    margin: '0 0 0.25rem 0',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    margin: 0,
  },
  chartContainer: {
    flexGrow: 1,
    width: '100%',
    paddingRight: '1rem',
    paddingTop: '0.5rem',
    minHeight: '200px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: 'auto',
  },
  tooltip: {
    background: 'var(--chart-tooltip-bg)',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    boxShadow: '0 4px 12px var(--card-shadow)',
  },
  statsContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--glass-border)',
  },
  statItem: {
    textAlign: 'center',
    flex: 1,
  },
  statLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
    letterSpacing: '0.5px',
  },
  statValue: {
    color: 'var(--accent)',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    margin: '0.25rem 0',
  },
  unit: {
    fontSize: '0.8rem',
    opacity: 0.8,
  },
  bestDayDate: {
    color: 'var(--text-secondary)',
    fontSize: '0.65rem',
    margin: '0.25rem 0 0 0',
  },
  divider: {
    width: '1px',
    height: '2.5rem',
    backgroundColor: 'var(--glass-border)',
  }
};

export default SystemTrends;