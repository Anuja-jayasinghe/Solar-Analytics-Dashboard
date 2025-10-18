import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getMonthlyData, 
  getYearlyData, 
  getLivePowerData, 
  getDashboardSummary, 
  getEnergyChartsData,
  getMonthlyGenerationData,
  getTotalGenerationData,
  getTotalEarningsData,
  clearCache,
  getCacheStats
} from '../lib/dataService';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  // State for different data types
  const [monthlyData, setMonthlyData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [livePowerData, setLivePowerData] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [energyChartsData, setEnergyChartsData] = useState(null);
  const [monthlyGenerationData, setMonthlyGenerationData] = useState(null);
  const [totalGenerationData, setTotalGenerationData] = useState(null);
  const [totalEarningsData, setTotalEarningsData] = useState(null);

  // Loading states
  const [loading, setLoading] = useState({
    monthly: false,
    yearly: false,
    live: false,
    summary: false,
    charts: false,
    monthlyGen: false,
    totalGen: false,
    totalEarnings: false
  });

  // Error states
  const [errors, setErrors] = useState({
    monthly: null,
    yearly: null,
    live: null,
    summary: null,
    charts: null,
    monthlyGen: null,
    totalGen: null,
    totalEarnings: null
  });

  // Background refresh state
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Cache statistics
  const [cacheStats, setCacheStats] = useState(null);

  /**
   * Generic data fetcher with error handling and loading states
   */
  const fetchData = useCallback(async (dataType, fetchFunction, setter, forceRefresh = false) => {
    setLoading(prev => ({ ...prev, [dataType]: true }));
    setErrors(prev => ({ ...prev, [dataType]: null }));

    try {
      const data = await fetchFunction(forceRefresh);
      setter(data);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error(`Error fetching ${dataType} data:`, error);
      setErrors(prev => ({ ...prev, [dataType]: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, [dataType]: false }));
    }
  }, []);

  /**
   * Fetch all data on initial load
   */
  const fetchAllData = useCallback(async (forceRefresh = false) => {
    const promises = [
      fetchData('monthly', getMonthlyData, setMonthlyData, forceRefresh),
      fetchData('yearly', getYearlyData, setYearlyData, forceRefresh),
      fetchData('live', getLivePowerData, setLivePowerData, forceRefresh),
      fetchData('summary', getDashboardSummary, setDashboardSummary, forceRefresh),
      fetchData('charts', getEnergyChartsData, setEnergyChartsData, forceRefresh),
      fetchData('monthlyGen', getMonthlyGenerationData, setMonthlyGenerationData, forceRefresh),
      fetchData('totalGen', getTotalGenerationData, setTotalGenerationData, forceRefresh),
      fetchData('totalEarnings', getTotalEarningsData, setTotalEarningsData, forceRefresh)
    ];

    await Promise.allSettled(promises);
  }, [fetchData]);

  /**
   * Background refresh function
   */
  const backgroundRefresh = useCallback(async () => {
    if (isBackgroundRefreshing) return;
    
    setIsBackgroundRefreshing(true);
    try {
      await fetchAllData(true); // Force refresh for background updates
      console.log('Background refresh completed');
    } catch (error) {
      console.error('Background refresh failed:', error);
    } finally {
      setIsBackgroundRefreshing(false);
    }
  }, [fetchAllData, isBackgroundRefreshing]);

  /**
   * Manual refresh function
   */
  const refreshData = useCallback(async (dataType = null) => {
    if (dataType) {
      // Refresh specific data type
      switch (dataType) {
        case 'monthly':
          await fetchData('monthly', getMonthlyData, setMonthlyData, true);
          break;
        case 'yearly':
          await fetchData('yearly', getYearlyData, setYearlyData, true);
          break;
        case 'live':
          await fetchData('live', getLivePowerData, setLivePowerData, true);
          break;
        case 'summary':
          await fetchData('summary', getDashboardSummary, setDashboardSummary, true);
          break;
        case 'charts':
          await fetchData('charts', getEnergyChartsData, setEnergyChartsData, true);
          break;
        case 'monthlyGen':
          await fetchData('monthlyGen', getMonthlyGenerationData, setMonthlyGenerationData, true);
          break;
        case 'totalGen':
          await fetchData('totalGen', getTotalGenerationData, setTotalGenerationData, true);
          break;
        case 'totalEarnings':
          await fetchData('totalEarnings', getTotalEarningsData, setTotalEarningsData, true);
          break;
        default:
          console.warn(`Unknown data type: ${dataType}`);
      }
    } else {
      // Refresh all data
      await fetchAllData(true);
    }
  }, [fetchData, fetchAllData]);

  /**
   * Clear all cached data
   */
  const clearAllCache = useCallback(() => {
    clearCache();
    setCacheStats(getCacheStats());
    console.log('Cache cleared');
  }, []);

  /**
   * Update cache statistics
   */
  const updateCacheStats = useCallback(() => {
    setCacheStats(getCacheStats());
  }, []);

  // Initialize data on mount
  useEffect(() => {
    fetchAllData();
    updateCacheStats();
  }, [fetchAllData, updateCacheStats]);

  // Set up background refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if tab is visible
      if (!document.hidden) {
        backgroundRefresh();
      }
    }, 3 * 60 * 1000); // 3 minutes

    return () => clearInterval(interval);
  }, [backgroundRefresh]);

  // Update cache stats periodically
  useEffect(() => {
    const statsInterval = setInterval(updateCacheStats, 30 * 1000); // Every 30 seconds
    return () => clearInterval(statsInterval);
  }, [updateCacheStats]);

  // Listen for visibility changes to refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && lastRefresh && Date.now() - lastRefresh > 5 * 60 * 1000) {
        // If tab becomes visible and last refresh was more than 5 minutes ago
        backgroundRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundRefresh, lastRefresh]);

  const value = {
    // Data
    monthlyData,
    yearlyData,
    livePowerData,
    dashboardSummary,
    energyChartsData,
    monthlyGenerationData,
    totalGenerationData,
    totalEarningsData,

    // Loading states
    loading,
    isBackgroundRefreshing,

    // Error states
    errors,

    // Actions
    refreshData,
    clearAllCache,
    backgroundRefresh,

    // Cache info
    cacheStats,
    lastRefresh,

    // Individual data fetchers (for components that need specific data)
    fetchMonthlyData: () => fetchData('monthly', getMonthlyData, setMonthlyData, true),
    fetchYearlyData: () => fetchData('yearly', getYearlyData, setYearlyData, true),
    fetchLivePowerData: () => fetchData('live', getLivePowerData, setLivePowerData, true),
    fetchDashboardSummary: () => fetchData('summary', getDashboardSummary, setDashboardSummary, true),
    fetchEnergyChartsData: () => fetchData('charts', getEnergyChartsData, setEnergyChartsData, true),
    fetchMonthlyGenerationData: () => fetchData('monthlyGen', getMonthlyGenerationData, setMonthlyGenerationData, true),
    fetchTotalGenerationData: () => fetchData('totalGen', getTotalGenerationData, setTotalGenerationData, true),
    fetchTotalEarningsData: () => fetchData('totalEarnings', getTotalEarningsData, setTotalEarningsData, true),
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
