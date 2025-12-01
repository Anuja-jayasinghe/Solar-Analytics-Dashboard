import React, { useMemo } from 'react';
import { DataContext } from './DataContext';

// DemoDataProvider overrides the regular DataContext with mock/demo data
// so existing components using useData() receive demo values.
export const DemoDataProvider = ({ children }) => {
  // Static demo data resembling real structures
  const energyChartsData = useMemo(() => ([
    { month: 'Jan', period: 'Jan 01 - Jan 31', inverter: 120, ceb: 100 },
    { month: 'Feb', period: 'Feb 01 - Feb 28', inverter: 140, ceb: 110 },
    { month: 'Mar', period: 'Mar 01 - Mar 31', inverter: 160, ceb: 120 },
  ]), []);

  const livePowerData = useMemo(() => ({
    status: 'Online',
    currentPower: { value: 2.8, unit: 'kW' },
    totalGeneration: { value: 1523.7, unit: 'kWh' },
    dailyGeneration: { value: 18.4, unit: 'kWh' },
    lastUpdated: new Date().toISOString(),
  }), []);

  const inverterPotentialValue = useMemo(() => ({ total: 12345 }), []);

  const totalEarningsData = useMemo(() => ({ total: 45678 }), []);

  const monthlyGenerationData = useMemo(() => ({
    total: 325.4,
    billingPeriodLabel: 'Nov 01 – Dec 01',
    startDate: '2025-11-01',
    billId: null,
  }), []);

  const loading = useMemo(() => ({
    charts: false,
    live: false,
    totalEarnings: false,
    monthlyGen: false,
    inverterValue: false,
  }), []);

  const errors = useMemo(() => ({
    charts: null,
    live: null,
    totalEarnings: null,
    monthlyGen: null,
    inverterValue: null,
  }), []);

  const value = {
    energyChartsData,
    livePowerData,
    totalEarningsData,
    monthlyGenerationData,
    inverterPotentialValue,
    loading,
    errors,
    refreshData: () => {},
    refreshAll: () => {},
    lastUpdate: { live: Date.now(), charts: Date.now(), totalEarnings: Date.now(), monthlyGen: Date.now() },
    isStale: false,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
