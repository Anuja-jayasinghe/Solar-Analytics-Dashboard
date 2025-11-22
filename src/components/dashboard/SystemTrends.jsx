import React, { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "example-key"
);

const SystemTrends = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState("");
  const [daysInPeriod, setDaysInPeriod] = useState(0);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      try {
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
          date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
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
  const { totalGeneration, dailyAverage, bestDay, maxPeakPower } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalGeneration: 0, dailyAverage: 0, bestDay: { value: 0, date: '' }, maxPeakPower: 0 };
    }
    
    const total = chartData.reduce((sum, d) => sum + (d.daily_generation_kwh || 0), 0);
    const average = chartData.length > 0 ? total / chartData.length : 0;
    
    const best = chartData.reduce((max, d) => {
      return (d.daily_generation_kwh || 0) > max.value 
        ? { value: d.daily_generation_kwh, date: d.date }
        : max;
    }, { value: 0, date: '' });
    
    const maxPeak = chartData.reduce((max, d) => Math.max(max, d.peak_power_kw || 0), 0);
    
    return { 
      totalGeneration: total, 
      dailyAverage: average, 
      bestDay: best,
      maxPeakPower: maxPeak
    };
  }, [chartData]);

  // Custom Tooltip for the bar chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={styles.tooltip}>
          <p style={{ margin: 0, padding: 0, color: 'var(--text-secondary)', fontWeight: 'bold' }}>
            {data.date}
          </p>
          <p style={{ margin: '4px 0 2px', padding: 0, color: 'var(--accent)' }}>
            Generation: {data.daily_generation_kwh.toFixed(2)} kWh
          </p>
          <p style={{ margin: '2px 0 0', padding: 0, color: '#4CAF50' }}>
            Peak Power: {data.peak_power_kw.toFixed(2)} kW
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
      <div style={styles.chartContainer}>
        {loading && <p style={styles.loadingText}>Loading generation data...</p>}
        {!loading && chartData.length === 0 && (
          <p style={styles.loadingText}>No data available for this billing period</p>
        )}
        {!loading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 0, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis 
                dataKey="date" 
                stroke="var(--chart-text)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis 
                stroke="var(--accent)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)', fontSize: 11 } }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--glass-border)' }} />
              <Bar 
                dataKey="daily_generation_kwh" 
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={25}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Billing Period Stats Section */}
      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Total</p>
          <p style={styles.statValue}>{totalGeneration.toFixed(1)} <span style={styles.unit}>kWh</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Daily Avg</p>
          <p style={styles.statValue}>{dailyAverage.toFixed(1)} <span style={styles.unit}>kWh</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Max Peak</p>
          <p style={styles.statValue}>{maxPeakPower.toFixed(2)} <span style={styles.unit}>kW</span></p>
        </div>
        <div style={styles.divider} />
        <div style={styles.statItem}>
          <p style={styles.statLabel}>Best Day</p>
          <p style={styles.statValue}>{bestDay.value.toFixed(1)} <span style={styles.unit}>kWh</span></p>
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
    paddingTop: '1rem',
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