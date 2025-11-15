import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Create the context
export const DataContext = createContext();

// Create the provider component
export const DataProvider = ({ children }) => {
  // Data states
  const [energyChartsData, setEnergyChartsData] = useState([]);
  const [livePowerData, setLivePowerData] = useState(null);
  const [totalGenerationData, setTotalGenerationData] = useState({ total: 0 }); // This is now redundant, but we'll leave it for 'TotalGenerationCard'
  const [totalEarningsData, setTotalEarningsData] = useState({ total: 0 });
  const [monthlyGenerationData, setMonthlyGenerationData] = useState({ total: 0 });
  // --- REMOVED inverterPotentialValue state ---

  // Loading and error states
  const [loading, setLoading] = useState({ 
    charts: true, live: true, totalGen: true, totalEarnings: true, monthlyGen: true
  });
  const [errors, setErrors] = useState({ 
    charts: null, live: null, totalGen: null, totalEarnings: null, monthlyGen: null
  });

  // The main function to fetch all dashboard data
  const fetchData = useCallback(async (key) => {
    if (!key) return;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      if (key === 'charts') {
        const { data: alignedData, error: rpcError } = await supabase.rpc('get_monthly_comparison');
        if (rpcError) throw rpcError;
        setEnergyChartsData(alignedData.map(d => ({ month: d.month_label, inverter: d.inverter_kwh, ceb: d.ceb_kwh })));
      } 
      
      else if (key === 'live') {
        const { data, error } = await supabase.functions.invoke('solis-live-data');
        if (error) throw error;
        setLivePowerData(data);
        localStorage.setItem('solisLiveData', JSON.stringify({ data, timestamp: Date.now() }));
        
        // --- OPTIMIZATION ---
        // Since we have the total generation here, let's also set totalGenerationData
        // This makes 'totalGen' fetch redundant
        const totalGen = data?.totalGeneration?.value || 0;
        setTotalGenerationData({ total: totalGen });
        setLoading((prev) => ({ ...prev, totalGen: false })); // Mark 'totalGen' as loaded
      }
      
      // --- This is now redundant but kept for other components. 'live' fetch is superior ---
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
      
      // --- REMOVED 'inverterValue' block ---
      
      else if (key === 'monthlyGen') {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
        const { data, error } = await supabase.from('inverter_data_daily_summary').select('total_generation_kwh').gte('summary_date', startDate).lt('summary_date', endDate);
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
        // Also set totalGen from cache
        const totalGen = data?.totalGeneration?.value || 0;
        setTotalGenerationData({ total: totalGen });
        setLoading(prev => ({...prev, live: false, totalGen: false}));
      }
    }

    Promise.all([
      fetchData('charts'),
      fetchData('live'),
      // We can remove this if 'live' always provides it
      // fetchData('totalGen'), 
      fetchData('totalEarnings'),
      fetchData('monthlyGen'),
    ]);
  }, [fetchData]);

  const refreshData = (key) => {
    fetchData(key);
  };

  const value = {
    energyChartsData, livePowerData, totalGenerationData, totalEarningsData, monthlyGenerationData,
    // inverterPotentialValue is removed
    loading, errors, refreshData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// Custom hook to use the context
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};