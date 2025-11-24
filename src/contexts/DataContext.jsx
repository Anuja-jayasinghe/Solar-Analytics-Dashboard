import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cacheService } from '../lib/cacheService';
import { supabase } from '../lib/supabaseClient';


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

  // Retry and circuit breaker states
  const retryStateRef = useRef({
    charts: { attempts: 0, nextRetry: null, consecutiveFailures: 0, circuitOpen: false },
    live: { attempts: 0, nextRetry: null, consecutiveFailures: 0, circuitOpen: false },
    totalEarnings: { attempts: 0, nextRetry: null, consecutiveFailures: 0, circuitOpen: false },
    monthlyGen: { attempts: 0, nextRetry: null, consecutiveFailures: 0, circuitOpen: false }
  });

  // Refs for polling intervals and fetchData (to avoid circular dependencies)
  const intervalsRef = useRef({});
  const fetchDataRef = useRef(null);

  // Error classification helper
  const classifyError = (error) => {
    // Check for HTTP status codes
    const status = error?.status || error?.code;
    const message = error?.message?.toLowerCase() || '';

    if (status === 401 || status === 403) {
      return { type: 'auth', shouldRetry: false, action: 'show-auth-modal' };
    }
    if (status === 429) {
      return { type: 'rate-limit', shouldRetry: true, action: 'extend-interval' };
    }
    if (status === 400 || status === 404) {
      return { type: 'client', shouldRetry: false, action: 'log-only' };
    }
    if (status >= 500 && status < 600) {
      return { type: 'server', shouldRetry: true, action: 'exponential-backoff' };
    }
    if (message.includes('timeout') || message.includes('network')) {
      return { type: 'transient', shouldRetry: true, action: 'exponential-backoff' };
    }
    
    // Default: treat as transient
    return { type: 'unknown', shouldRetry: true, action: 'exponential-backoff' };
  };

  // Calculate retry delay with exponential backoff
  const getRetryDelay = (attempts) => {
    const delays = [30000, 60000, 300000]; // 30s, 1m, 5m
    return delays[Math.min(attempts, delays.length - 1)];
  };

  // Schedule retry for a specific key (using ref to avoid circular dependency)
  const scheduleRetry = (key, error) => {
    const errorClass = classifyError(error);
    const retryState = retryStateRef.current[key];

    if (!errorClass.shouldRetry) {
      console.log(`[DataContext] Error for ${key} is not retryable:`, errorClass.type);
      retryState.attempts = 0;
      return;
    }

    retryState.attempts += 1;
    retryState.consecutiveFailures += 1;

    // Circuit breaker: open circuit after 5 consecutive failures
    if (retryState.consecutiveFailures >= 5) {
      console.warn(`[DataContext] Circuit breaker opened for ${key} after 5 consecutive failures`);
      retryState.circuitOpen = true;
      retryState.nextRetry = Date.now() + 30 * 60 * 1000; // 30 minutes pause
      return;
    }

    // Max 3 retries, then 30-min pause
    if (retryState.attempts >= 3) {
      console.warn(`[DataContext] Max retries reached for ${key}, pausing for 30 minutes`);
      retryState.attempts = 0;
      retryState.nextRetry = Date.now() + 30 * 60 * 1000;
      return;
    }

    const delay = getRetryDelay(retryState.attempts - 1);
    retryState.nextRetry = Date.now() + delay;
    
    console.log(`[DataContext] Scheduling retry ${retryState.attempts}/3 for ${key} in ${delay/1000}s`);
    
    setTimeout(() => {
      console.log(`[DataContext] Retrying ${key} (attempt ${retryState.attempts})`);
      // Call fetchData directly - no circular dependency since it's in setTimeout
      fetchDataRef.current(key);
    }, delay);
  };

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
        // Fetch latest CEB bill date
        const { data: latestBill, error: billError } = await supabase
          .from('ceb_data')
          .select('bill_date, id')
          .order('bill_date', { ascending: false })
          .limit(1)
          .single();
        
        let startDate, endDate, billingPeriodLabel, billId;
        const today = new Date();
        
        if (latestBill && !billError) {
          // Use latest CEB bill date as start of period
          const billDate = new Date(latestBill.bill_date);
          billId = latestBill.id;
          
          startDate = billDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          endDate = today.toISOString().split('T')[0];
          
          const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          billingPeriodLabel = `${formatDate(billDate)} – ${formatDate(today)}`;
        } else {
          // Fallback to first-of-month if no CEB bill found
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          billingPeriodLabel = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
        
        const { data, error } = await supabase
          .from('inverter_data_daily_summary')
          .select('total_generation_kwh')
          .gte('summary_date', startDate)
          .lte('summary_date', endDate);
        
        if (error) throw error;
        
        const total = data.reduce((sum, record) => sum + (parseFloat(record.total_generation_kwh) || 0), 0);
        const result = { total, billingPeriodLabel, startDate, billId };
        
        setMonthlyGenerationData(result);
        cacheService.set(key, 'data', result);
        setLastUpdate(prev => ({ ...prev, [key]: Date.now() }));
      }

      // Clear errors and reset retry state on success
      setErrors((prev) => ({ ...prev, [key]: null }));
      const retryState = retryStateRef.current[key];
      retryState.attempts = 0;
      retryState.consecutiveFailures = 0;
      retryState.circuitOpen = false;
      retryState.nextRetry = null;
      
    } catch (err) {
      console.error(`Error in DataContext fetching ${key}:`, err);
      
      // Classify error and determine action
      const errorClass = classifyError(err);
      
      // Keep showing cached data on error; just mark error
      const errorMessage = err.message || 'Unknown error';
      if (key === 'live') {
        setErrors((prev) => ({ 
          ...prev, 
          live: { message: errorMessage, type: errorClass.type, time: Date.now() },
          inverterValue: { message: errorMessage, type: errorClass.type, time: Date.now() }
        }));
      } else {
        setErrors((prev) => ({ 
          ...prev, 
          [key]: { message: errorMessage, type: errorClass.type, time: Date.now() }
        }));
      }

      // Handle retry logic based on error classification
      if (errorClass.shouldRetry) {
        scheduleRetry(key, err);
      }
    } finally {
      if (key !== 'live') {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    }
  }, []);

  // Store fetchData in ref for retry mechanism
  fetchDataRef.current = fetchData;

  // Setup polling intervals with visibility awareness
  const setupPolling = useCallback(() => {
    const pollingConfig = {
      live: 5 * 60 * 1000,        // 5 minutes
      charts: 15 * 60 * 1000,     // 15 minutes
      totalEarnings: 15 * 60 * 1000, // 15 minutes
      monthlyGen: 15 * 60 * 1000  // 15 minutes
    };

    const shouldPoll = (key) => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) {
        return false;
      }

      // Check circuit breaker
      const retryState = retryStateRef.current[key];
      if (retryState.circuitOpen && Date.now() < retryState.nextRetry) {
        console.log(`[DataContext] Circuit breaker open for ${key}, skipping poll`);
        return false;
      }

      // Check if waiting for retry
      if (retryState.nextRetry && Date.now() < retryState.nextRetry) {
        console.log(`[DataContext] Waiting for retry for ${key}, skipping poll`);
        return false;
      }

      // Reset circuit breaker if cooldown expired
      if (retryState.circuitOpen && Date.now() >= retryState.nextRetry) {
        console.log(`[DataContext] Circuit breaker reset for ${key}`);
        retryState.circuitOpen = false;
        retryState.consecutiveFailures = 0;
        retryState.attempts = 0;
      }

      return true;
    };

    Object.entries(pollingConfig).forEach(([key, interval]) => {
      if (intervalsRef.current[key]) {
        clearInterval(intervalsRef.current[key]);
      }

      intervalsRef.current[key] = setInterval(() => {
        if (shouldPoll(key)) {
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