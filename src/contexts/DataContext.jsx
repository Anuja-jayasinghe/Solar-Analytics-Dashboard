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
  const [totalEarningsData, setTotalEarningsData] = useState({ total: 0 });
  const [monthlyGenerationData, setMonthlyGenerationData] = useState({ total: 0 });
  const [inverterPotentialValue, setInverterPotentialValue] = useState({ total: 0 }); 

  // Loading and error states
  const [loading, setLoading] = useState({ 
    charts: true, live: true, totalEarnings: true, monthlyGen: true, inverterValue: true 
  });
  const [errors, setErrors] = useState({ 
    charts: null, live: null, totalEarnings: null, monthlyGen: null, inverterValue: null 
  });

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
        console.log("--- 💰 Starting Potential Earnings Calculation ---");
        setLoading(prev => ({ ...prev, inverterValue: true }));
        setErrors(prev => ({ ...prev, inverterValue: null }));

        // 1. Fetch live data (which now includes totalGeneration)
        const { data: liveData, error: liveError } = await supabase.functions.invoke('solis-live-data');
        if (liveError) throw liveError;
        setLivePowerData(liveData);
        localStorage.setItem('solisLiveData', JSON.stringify({ data: liveData, timestamp: Date.now() }));
        
        console.log("1. Raw API Response:", liveData);
        
        // 2. Fetch the tariff from settings
        const { data: settingData, error: settingError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_name', 'rate_per_kwh')
          .limit(1);
        if (settingError) throw settingError;
        
        console.log("2. Fetched Tariff Data:", settingData);

        const tariff = parseFloat(settingData?.[0]?.setting_value) || 50; 
        console.log("3. Parsed Tariff Rate:", tariff, "LKR/kWh");

        // 4. --- THIS IS THE MWh to kWh FIX ---
        const totalGen_MWh = liveData?.totalGeneration?.value || 0;
        console.log("4. Extracted Total Generation:", totalGen_MWh, liveData?.totalGeneration?.unit);

        const totalGen_kWh = totalGen_MWh * 1000; // Convert MWh to kWh
        console.log("5. Converted to kWh:", totalGen_kWh, "kWh");
        
        // 5. Calculate and set the potential value
        const potentialValue = totalGen_kWh * tariff;
        console.log(`6. Final Calculation: ${totalGen_kWh} kWh * ${tariff} LKR =`, potentialValue, "LKR");
        
        setInverterPotentialValue({ total: potentialValue });
        
        console.log("--- ✅ Calculation Complete ---");
        
        setLoading(prev => ({ ...prev, live: false, inverterValue: false }));
      }
      
      else if (key === 'totalEarnings') {
        const { data, error } = await supabase.from('ceb_data').select('earnings');
        if (error) throw error;
        const total = data.reduce((sum, record) => sum + (record.earnings || 0), 0);
        
        // Log the other side of the comparison
        console.log("--- 💰 Fetched Actual CEB Earnings ---");
        console.log("7. Final Actual Earnings (CEB):", total, "LKR");
        
        setTotalEarningsData({ total });
      }
      
      // 'inverterValue' logic is now part of 'live'
      
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
      if (key === 'live') {
        setErrors((prev) => ({ ...prev, live: err.message, inverterValue: err.message }));
      } else {
        setErrors((prev) => ({ ...prev, [key]: err.message }));
      }
    } finally {
      if (key !== 'live') {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
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
      fetchData('live'), // This now also triggers 'inverterValue' calculation
      fetchData('totalEarnings'),
      fetchData('monthlyGen'),
    ]);
  }, [fetchData]);

  const refreshData = (key) => {
    fetchData(key);
  };

  const value = {
    energyChartsData, livePowerData, totalEarningsData, monthlyGenerationData,
    inverterPotentialValue,
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