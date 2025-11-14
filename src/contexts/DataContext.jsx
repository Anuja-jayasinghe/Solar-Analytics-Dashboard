import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// 1. Export the context so the hook can use it
export const DataContext = createContext();

// Create the provider component
export const DataProvider = ({ children }) => {
  // Data states
  const [energyChartsData, setEnergyChartsData] = useState([]);
  const [livePowerData, setLivePowerData] = useState(null);
  const [totalGenerationData, setTotalGenerationData] = useState({ total: 0 });
  const [totalEarningsData, setTotalEarningsData] = useState({ total: 0 });
  const [monthlyGenerationData, setMonthlyGenerationData] = useState({ total: 0 });
  
  const [loading, setLoading] = useState({ charts: true, live: true, totalGen: true, totalEarnings: true, monthlyGen: true });
  const [errors, setErrors] = useState({ charts: null, live: null, totalGen: null, totalEarnings: null, monthlyGen: null });

  const fetchData = useCallback(async (key) => {
    if (!key) return;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      if (key === 'charts') {
        const { data, error } = await supabase.rpc('get_monthly_comparison');
        if (error) throw error;
        setEnergyChartsData(data.map(d => ({ month: d.month_label, inverter: d.inverter_kwh, ceb: d.ceb_kwh })));
      } 
      
      else if (key === 'live') {
        const { data, error } = await supabase.functions.invoke('solis-live-data');
        if (error) throw error;
        setLivePowerData(data);
        localStorage.setItem('solisLiveData', JSON.stringify({ data, timestamp: Date.now() }));
      }
      
      else if (key === 'totalGen') {
        const { data, error } = await supabase.from('inverter_data_daily_summary').select('total_generation_kwh');
        if (error) throw error;
        const total = data.reduce((sum, record) => sum + (parseFloat(record.total_generation_kwh) || 0), 0);
        setTotalGenerationData({ total });
      }
      
      else if (key === 'totalEarnings') {
        const { data, error } = await supabase.from('ceb_data').select('earnings');
        if (error) throw error;
        const total = data.reduce((sum, record) => sum + (record.earnings || 0), 0);
        setTotalEarningsData({ total });
      }
      
      else if (key === 'monthlyGen') {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();

        const { data, error } = await supabase
          .from('inverter_data_daily_summary')
          .select('total_generation_kwh')
          .gte('summary_date', startDate)
          .lt('summary_date', endDate);

        if (error) throw error;
        const total = data.reduce((sum, record) => sum + (parseFloat(record.total_generation_kwh) || 0), 0);
        setMonthlyGenerationData({ total });
      }
      
    } catch (err) {
      console.error(`Error in DataContext fetching ${key}:`, err);
      setErrors((prev) => ({ ...prev, [key]: err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem('solisLiveData');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 300000) {
        setLivePowerData(data);
        setLoading(prev => ({...prev, live: false}));
      }
    }

    Promise.all([
      fetchData('charts'),
      fetchData('live'),
      fetchData('totalGen'),
      fetchData('totalEarnings'),
      fetchData('monthlyGen'),
    ]);
  }, [fetchData]);

  const refreshData = (key) => {
    fetchData(key);
  };

  const value = {
    energyChartsData, livePowerData, totalGenerationData, totalEarningsData, monthlyGenerationData,
    loading, errors, refreshData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// 2. We have removed the 'useData' hook from this file.