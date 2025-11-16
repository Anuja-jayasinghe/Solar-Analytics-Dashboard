import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cacheService } from '../lib/cacheService';

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

  // Metadata states
  const [lastUpdate, setLastUpdate] = useState({});
  const [isStale, setIsStale] = useState(false);

  // Refs for polling intervals
  const intervalsRef = useRef({});

  const fetchData = useCallback(async (key, skipCache = false) => {
    if (!key) return;

    // SWR: Check cache first and return immediately if available
    if (!skipCache) {
      const cached = cacheService.get(key, 'data');
      if (cached) {
        console.log(`[DataContext] Cache hit for ${key}`);
        // Set data immediately from cache
        if (key === 'charts') setEnergyChartsData(cached);
        else if (key === 'live') {
          setLivePowerData(cached.liveData);
          setInverterPotentialValue(cached.inverterPotentialValue);
        }
        else if (key === 'totalEarnings') setTotalEarningsData(cached);
        else if (key === 'monthlyGen') setMonthlyGenerationData(cached);
        
        // Mark as not loading since we have cached data
        setLoading((prev) => ({ ...prev, [key]: false, inverterValue: key === 'live' ? false : prev.inverterValue }));
      } else {
        // No cache, show loading
        setLoading((prev) => ({ ...prev, [key]: true }));
      }
    } else {
      setLoading((prev) => ({ ...prev, [key]: true }));
    }

    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      if (key === 'charts') {
        const { data: alignedData, error: rpcError } = await supabase.rpc('get_monthly_comparison');
        if (rpcError) throw rpcError;
        const processedData = alignedData.map(d => ({ 
          month: d.month_label, 
          period: d.period_label, // Billing period e.g., "Oct 05 - Nov 04"
          inverter: d.inverter_kwh, 
          ceb: d.ceb_kwh 
        }));
        setEnergyChartsData(processedData);
        cacheService.set(key, 'data', processedData);
        setLastUpdate(prev => ({ ...prev, [key]: Date.now() }));
      } 
      
      else if (key === 'live') {
        setLoading(prev => ({ ...prev, inverterValue: true }));
        setErrors(prev => ({ ...prev, inverterValue: null }));

        // Fetch live data
        const { data: liveData, error: liveError } = await supabase.functions.invoke('solis-live-data');
        if (liveError) throw liveError;
        setLivePowerData(liveData);
        
        // Fetch tariff from settings
        const { data: settingData, error: settingError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_name', 'rate_per_kwh')
          .limit(1);
        if (settingError) throw settingError;
        
        const tariff = parseFloat(settingData?.[0]?.setting_value) || 37; 

        // Convert MWh to kWh
        const totalGen_MWh = liveData?.totalGeneration?.value || 0;
        const totalGen_kWh = totalGen_MWh * 1000;
        
        // Calculate potential value
        const potentialValue = totalGen_kWh * tariff;
        setInverterPotentialValue({ total: potentialValue });

        // Cache both live data and calculated potential
        cacheService.set(key, 'data', { liveData, inverterPotentialValue: { total: potentialValue } });
        setLastUpdate(prev => ({ ...prev, [key]: Date.now(), inverterValue: Date.now() }));
        
        setLoading(prev => ({ ...prev, live: false, inverterValue: false }));
      }
      
      else if (key === 'totalEarnings') {
        const { data, error } = await supabase.from('ceb_data').select('earnings');
        if (error) throw error;
        const total = data.reduce((sum, record) => sum + (record.earnings || 0), 0);
        const result = { total };
        setTotalEarningsData(result);
        cacheService.set(key, 'data', result);
        setLastUpdate(prev => ({ ...prev, [key]: Date.now() }));
      }
      
      else if (key === 'monthlyGen') {
        // Fetch billing period settings
        const { data: billingSettings, error: settingsError } = await supabase
          .from('system_settings')
          .select('setting_name, setting_value')
          .in('setting_name', ['last_billing_date', 'billing_cycle_days']);
        
        const lastBillingDateStr = billingSettings?.find(s => s.setting_name === 'last_billing_date')?.setting_value;
        const billingCycleDays = parseInt(billingSettings?.find(s => s.setting_name === 'billing_cycle_days')?.setting_value || '30');
        
        let startDate, endDate, billingPeriodLabel;
        const today = new Date();
        
        if (lastBillingDateStr) {
          // Use billing period logic
          const lastBillingDate = new Date(lastBillingDateStr);
          
          // Calculate current billing period start
          // Find the most recent billing date that's <= today
          let currentPeriodStart = new Date(lastBillingDate);
          while (currentPeriodStart < today) {
            const nextStart = new Date(currentPeriodStart);
            nextStart.setDate(nextStart.getDate() + billingCycleDays);
            if (nextStart > today) break;
            currentPeriodStart = nextStart;
          }
          
          startDate = currentPeriodStart.toISOString();
          endDate = today.toISOString();
          
          const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          billingPeriodLabel = `${formatDate(currentPeriodStart)} – ${formatDate(today)}`;
        } else {
          // Fallback to first-of-month
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
          billingPeriodLabel = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
        
        const { data, error } = await supabase
          .from('inverter_data_daily_summary')
          .select('total_generation_kwh')
          .gte('summary_date', startDate)
          .lt('summary_date', endDate);
        
        if (error) throw error;
        
        const total = data.reduce((sum, record) => sum + (parseFloat(record.total_generation_kwh) || 0), 0);
        const result = { total, billingPeriodLabel };
        
        setMonthlyGenerationData(result);
        cacheService.set(key, 'data', result);
        setLastUpdate(prev => ({ ...prev, [key]: Date.now() }));
      }

      // Clear errors on success
      setErrors((prev) => ({ ...prev, [key]: null }));
      
    } catch (err) {
      console.error(`Error in DataContext fetching ${key}:`, err);
      // Keep showing cached data on error; just mark error
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

  // Setup polling intervals with visibility awareness
  const setupPolling = useCallback(() => {
    const pollingConfig = {
      live: 5 * 60 * 1000,        // 5 minutes
      charts: 15 * 60 * 1000,     // 15 minutes
      totalEarnings: 15 * 60 * 1000, // 15 minutes
      monthlyGen: 15 * 60 * 1000  // 15 minutes
    };

    const shouldPoll = () => {
      return document.visibilityState === 'visible' && navigator.onLine;
    };

    Object.entries(pollingConfig).forEach(([key, interval]) => {
      if (intervalsRef.current[key]) {
        clearInterval(intervalsRef.current[key]);
      }

      intervalsRef.current[key] = setInterval(() => {
        if (shouldPoll()) {
          console.log(`[DataContext] Polling ${key}`);
          fetchData(key);
        }
      }, interval);
    });

    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, [fetchData]);

  // Initial data fetch on mount
  useEffect(() => {
    // Fetch all data types (SWR will check cache first)
    Promise.all([
      fetchData('charts'),
      fetchData('live'),
      fetchData('totalEarnings'),
      fetchData('monthlyGen'),
    ]);

    // Setup polling intervals
    const cleanup = setupPolling();

    return cleanup;
  }, [fetchData, setupPolling]);

  // Handle visibility and network changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[DataContext] Tab visible, refreshing data');
        // Immediate refresh when tab becomes visible
        fetchData('live');
        fetchData('charts');
        fetchData('totalEarnings');
        fetchData('monthlyGen');
      }
    };

    const handleOnline = () => {
      console.log('[DataContext] Network online, refreshing data');
      fetchData('live');
      fetchData('charts');
      fetchData('totalEarnings');
      fetchData('monthlyGen');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchData]);

  // Check for stale data every minute
  useEffect(() => {
    const checkStale = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes
      const anyStale = Object.values(lastUpdate).some(timestamp => 
        timestamp && (now - timestamp > staleThreshold)
      );
      setIsStale(anyStale);
    }, 60 * 1000);

    return () => clearInterval(checkStale);
  }, [lastUpdate]);

  const refreshData = useCallback((key) => {
    if (key) {
      fetchData(key, true); // Skip cache for manual refresh
    } else {
      // Refresh all
      fetchData('charts', true);
      fetchData('live', true);
      fetchData('totalEarnings', true);
      fetchData('monthlyGen', true);
    }
  }, [fetchData]);

  const refreshAll = useCallback(() => {
    cacheService.clear();
    refreshData();
  }, [refreshData]);

  const value = {
    energyChartsData, 
    livePowerData, 
    totalEarningsData, 
    monthlyGenerationData,
    inverterPotentialValue,
    loading, 
    errors, 
    refreshData,
    refreshAll,
    lastUpdate,
    isStale
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