import React, { useMemo } from 'react';
import { DataContext } from './DataContext';

// DemoDataProvider overrides the regular DataContext with mock/demo data
// so existing components using useData() receive demo values.
export const DemoDataProvider = ({ children }) => {
  // Realistic 16-month demo data with seasonal patterns for Sri Lankan solar system
  // Sri Lanka seasons: Yala (May-Aug dry), Maha (Oct-Jan wet), Inter-monsoon transitions
  // Average ~3600 kWh per billing period
  const energyChartsData = useMemo(() => ([
    // 2024 - Starting summer dry season (high generation)
    { month: 'Aug 24', period: 'Aug 05 - Sep 04, 2024', inverter: 3876.5, ceb: 3682.7 },
    { month: 'Sep 24', period: 'Sep 05 - Oct 04, 2024', inverter: 3748.2, ceb: 3812.6 }, // CEB higher (meter read included previous overflow)
    // Oct-Nov: Start of Maha monsoon (generation drops)
    { month: 'Oct 24', period: 'Oct 05 - Nov 04, 2024', inverter: 3078.3, ceb: 2924.4 },
    { month: 'Nov 24', period: 'Nov 05 - Dec 04, 2024', inverter: 2571.7, ceb: 2689.3 }, // CEB higher (billing cycle timing)
    // Dec-Jan: Peak monsoon season (lowest generation, cloudy/rainy)
    { month: 'Dec 24', period: 'Dec 05 - Jan 04, 2025', inverter: 2112.5, ceb: 2006.9 },
    { month: 'Jan 25', period: 'Jan 05 - Feb 04, 2025', inverter: 2272.8, ceb: 2389.4 }, // CEB higher (end-of-year adjustments)
    // Feb: End of monsoon, improving
    { month: 'Feb 25', period: 'Feb 05 - Mar 04, 2025', inverter: 2840.8, ceb: 2698.8 },
    // Mar-Apr: Inter-monsoon transition (good generation returns)
    { month: 'Mar 25', period: 'Mar 05 - Apr 04, 2025', inverter: 3643.9, ceb: 3789.2 }, // CEB higher (meter recalibration)
    { month: 'Apr 25', period: 'Apr 05 - May 04, 2025', inverter: 3914.6, ceb: 3718.9 },
    // May-Aug: Yala dry season (peak generation, long sunny days)
    { month: 'May 25', period: 'May 05 - Jun 04, 2025', inverter: 4134.2, ceb: 4287.5 }, // CEB higher (spillover from previous period)
    { month: 'Jun 25', period: 'Jun 05 - Jul 04, 2025', inverter: 4298.1, ceb: 4083.2 },
    { month: 'Jul 25', period: 'Jul 05 - Aug 04, 2025', inverter: 4372.6, ceb: 4153.9 },
    { month: 'Aug 25', period: 'Aug 05 - Sep 04, 2025', inverter: 4222.5, ceb: 4356.8 }, // CEB higher (billing period mismatch)
    // Sep: Transitioning back to monsoon
    { month: 'Sep 25', period: 'Sep 05 - Oct 04, 2025', inverter: 3790.1, ceb: 3600.6 },
    // Oct-Nov: Maha monsoon returns (generation declining)
    { month: 'Oct 25', period: 'Oct 05 - Nov 04, 2025', inverter: 3224.6, ceb: 3063.4 },
    { month: 'Nov 25', period: 'Nov 05 - Dec 01, 2025', inverter: 2617.8, ceb: 2486.9 },
  ]), []);

  const livePowerData = useMemo(() => ({
    status: 'Online',
    currentPower: { value: 28.2, unit: 'kW' },
    totalGeneration: { value: 28.456, unit: 'MWh' }, // 28,456 kWh total lifetime
    dailyGeneration: { value: 94.8, unit: 'kWh' },
    lastUpdated: new Date().toISOString(),
  }), []);

  const inverterPotentialValue = useMemo(() => ({ total: 1054720 }), []); // ~28,456 kWh * 37 LKR

  const totalEarningsData = useMemo(() => ({ total: 989234 }), []); // Slightly less than potential

  const monthlyGenerationData = useMemo(() => ({
    total: 2617.8,
    billingPeriodLabel: 'Nov 05 – Dec 01',
    startDate: '2025-11-05',
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
