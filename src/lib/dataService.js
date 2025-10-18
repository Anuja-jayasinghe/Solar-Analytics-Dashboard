import { supabase } from './supabaseClient'
import { cacheService } from './cacheService'

const schema = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'
const cebTable = import.meta.env.VITE_SUPABASE_TABLE_CEB || 'ceb_data'
const inverterTable = import.meta.env.VITE_SUPABASE_TABLE_INVERTER || 'inverter_data'

function monthKeyFromDateString(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${new Intl.DateTimeFormat('en', { month: 'short' }).format(d)}-${String(y)}`
}

function aggregateMonthly(cebRows, inverterRows) {
  const map = new Map()
  for (const r of cebRows) {
    const key = monthKeyFromDateString(r.bill_date)
    const existing = map.get(key) || { month: key, ceb: 0, inverter: 0, cebEarnings: 0, inverterEarnings: 0 }
    existing.ceb += Number(r.units_exported || 0)
    // Use earnings directly from the table
    existing.cebEarnings += Number(r.earnings || 0)
    map.set(key, existing)
  }
  for (const r of inverterRows) {
    const key = monthKeyFromDateString(r.date)
    const existing = map.get(key) || { month: key, ceb: 0, inverter: 0, cebEarnings: 0, inverterEarnings: 0 }
    existing.inverter += Number(r.generation_kwh || 0)
    const computedEarningsInv = Number(r.generation_kwh || 0) * Number(r.rate_per_kwh || 0)
    const earningsInv = r.earnings ?? computedEarningsInv
    existing.inverterEarnings += Number(earningsInv || 0)
    map.set(key, existing)
  }
  const entries = Array.from(map.values())
  // Sort by year then month
  entries.sort((a, b) => {
    const [am, ay] = a.month.split('-')
    const [bm, by] = b.month.split('-')
    if (ay !== by) return Number(ay) - Number(by)
    const order = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return order.indexOf(am) - order.indexOf(bm)
  })
  return entries
}

function aggregateYearly(cebRows, inverterRows) {
  const map = new Map()
  for (const r of cebRows) {
    const y = new Date(r.bill_date).getFullYear()
    const existing = map.get(y) || { year: String(y), ceb: 0, inverter: 0, cebEarnings: 0, inverterEarnings: 0 }
    existing.ceb += Number(r.units_exported || 0)
    // Use earnings directly from the table
    existing.cebEarnings += Number(r.earnings || 0)
    map.set(y, existing)
  }
  for (const r of inverterRows) {
    const y = new Date(r.date).getFullYear()
    const existing = map.get(y) || { year: String(y), ceb: 0, inverter: 0, cebEarnings: 0, inverterEarnings: 0 }
    existing.inverter += Number(r.generation_kwh || 0)
    const computedEarningsInvY = Number(r.generation_kwh || 0) * Number(r.rate_per_kwh || 0)
    const earningsInvY = r.earnings ?? computedEarningsInvY
    existing.inverterEarnings += Number(earningsInvY || 0)
    map.set(y, existing)
  }
  const entries = Array.from(map.values())
  entries.sort((a, b) => Number(a.year) - Number(b.year))
  return entries
}

/**
 * Enhanced data fetching with caching
 */
export async function getMonthlyData(forceRefresh = false) {
  const cacheKey = 'monthly_aggregated';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('monthly', cacheKey)) {
    return cacheService.get('monthly', cacheKey);
  }

  try {
    const [{ data: ceb, error: cebError }, { data: inv, error: invError }] = await Promise.all([
      supabase.schema(schema).from(cebTable).select('bill_date,units_exported,earnings'),
      supabase.schema(schema).from(inverterTable).select('date,generation_kwh,earnings,rate_per_kwh'),
    ])
    
    if (cebError) throw new Error(`Fetch ${schema}.${cebTable} failed: ${cebError.message}`)
    if (invError) throw new Error(`Fetch ${schema}.${inverterTable} failed: ${invError.message}`)
    
    const result = aggregateMonthly(ceb || [], inv || []);
    
    // Cache the result
    cacheService.set('monthly', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('monthly', cacheKey);
    if (cached) {
      console.warn('Using cached monthly data due to fetch error');
      return cached;
    }
    throw error;
  }
}

export async function getYearlyData(forceRefresh = false) {
  const cacheKey = 'yearly_aggregated';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('yearly', cacheKey)) {
    return cacheService.get('yearly', cacheKey);
  }

  try {
    const [{ data: ceb, error: cebError }, { data: inv, error: invError }] = await Promise.all([
      supabase.schema(schema).from(cebTable).select('bill_date,units_exported,earnings'),
      supabase.schema(schema).from(inverterTable).select('date,generation_kwh,earnings,rate_per_kwh'),
    ])
    
    if (cebError) throw new Error(`Fetch ${schema}.${cebTable} failed: ${cebError.message}`)
    if (invError) throw new Error(`Fetch ${schema}.${inverterTable} failed: ${invError.message}`)
    
    const result = aggregateYearly(ceb || [], inv || []);
    
    // Cache the result
    cacheService.set('yearly', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching yearly data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('yearly', cacheKey);
    if (cached) {
      console.warn('Using cached yearly data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get live power data with caching
 */
export async function getLivePowerData(forceRefresh = false) {
  const cacheKey = 'live_power';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('live', cacheKey)) {
    return cacheService.get('live', cacheKey);
  }

  try {
    const { data, error } = await supabase.functions.invoke("solis-live-data");
    if (error) throw error;

    const result = {
      currentPower: data?.currentPower?.value ?? 0,
      dailyGeneration: data?.dailyGeneration?.value ?? 0,
      status: data?.status ?? "Offline",
      timestamp: Date.now()
    };

    // Cache the result
    cacheService.set('live', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching live power data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('live', cacheKey);
    if (cached) {
      console.warn('Using cached live data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get dashboard summary data with caching
 */
export async function getDashboardSummary(forceRefresh = false) {
  const cacheKey = 'dashboard_summary';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('daily', cacheKey)) {
    return cacheService.get('daily', cacheKey);
  }

  try {
    const [{ data: ceb, error: cebError }, { data: inv, error: invError }] = await Promise.all([
      supabase
        .from("ceb_data")
        .select("units_exported, earnings")
        .order("bill_date", { ascending: false })
        .limit(1),
      supabase
        .from("inverter_data_daily_summary")
        .select("total_generation_kwh")
        .order("summary_date", { ascending: false })
        .limit(1)
    ]);

    if (cebError) throw new Error(`CEB data fetch failed: ${cebError.message}`);
    if (invError) throw new Error(`Inverter data fetch failed: ${invError.message}`);

    const result = {
      ceb_units: ceb?.[0]?.units_exported || 0,
      ceb_earnings: ceb?.[0]?.earnings || 0,
      inverter_gen: inv?.[0]?.total_generation_kwh || 0,
      inverter_earnings: (inv?.[0]?.total_generation_kwh || 0) * 50, // rough rate
      timestamp: Date.now()
    };

    // Cache the result
    cacheService.set('daily', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('daily', cacheKey);
    if (cached) {
      console.warn('Using cached dashboard summary due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get energy charts data with caching
 */
export async function getEnergyChartsData(forceRefresh = false) {
  const cacheKey = 'energy_charts';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('monthly', cacheKey)) {
    return cacheService.get('monthly', cacheKey);
  }

  try {
    const [{ data: inv }, { data: ceb }] = await Promise.all([
      supabase
        .from("inverter_data_monthly_summary")
        .select("summary_month, total_generation_kwh"),
      supabase
        .from("ceb_data")
        .select("bill_date, units_exported")
    ]);

    const merged = inv.map((i) => {
      const month = i.summary_month;
      const cebMonth = ceb.find((c) =>
        c.bill_date?.startsWith(month)
      );
      return {
        month,
        inverter: i.total_generation_kwh,
        ceb: cebMonth?.units_exported || 0,
      };
    });
    
    // Sort data by year and month in ascending order
    const sortedData = merged.sort((a, b) => {
      const [yearA, monthA] = a.month.split('-').map(Number);
      const [yearB, monthB] = b.month.split('-').map(Number);
      
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      return monthA - monthB;
    });

    // Cache the result
    cacheService.set('monthly', cacheKey, sortedData);
    
    return sortedData;
  } catch (error) {
    console.error('Error fetching energy charts data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('monthly', cacheKey);
    if (cached) {
      console.warn('Using cached energy charts data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Clear all cached data
 */
export function clearCache() {
  cacheService.clear();
}

/**
 * Get monthly generation data with caching
 */
export async function getMonthlyGenerationData(forceRefresh = false) {
  const cacheKey = 'monthly_generation';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('daily', cacheKey)) {
    return cacheService.get('daily', cacheKey);
  }

  try {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("inverter_data_daily_summary")
      .select("total_generation_kwh")
      .gte("summary_date", startOfMonth);

    if (error) throw new Error(`Monthly generation fetch failed: ${error.message}`);

    const totalKwh = data.reduce(
      (sum, r) => sum + Number(r.total_generation_kwh || 0),
      0
    );

    const result = {
      total: totalKwh,
      timestamp: Date.now()
    };

    // Cache the result
    cacheService.set('daily', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching monthly generation data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('daily', cacheKey);
    if (cached) {
      console.warn('Using cached monthly generation data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get total generation data with caching
 */
export async function getTotalGenerationData(forceRefresh = false) {
  const cacheKey = 'total_generation';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('daily', cacheKey)) {
    return cacheService.get('daily', cacheKey);
  }

  try {
    const { data, error } = await supabase
      .from("system_metrics")
      .select("metric_value")
      .eq("metric_name", "total_generation")
      .single();

    if (error) throw new Error(`Total generation fetch failed: ${error.message}`);

    const result = {
      total: Number(data.metric_value) || 0,
      timestamp: Date.now()
    };

    // Cache the result
    cacheService.set('daily', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching total generation data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('daily', cacheKey);
    if (cached) {
      console.warn('Using cached total generation data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get total earnings data with caching
 */
export async function getTotalEarningsData(forceRefresh = false) {
  const cacheKey = 'total_earnings';
  
  // Return cached data if available and not forcing refresh
  if (!forceRefresh && cacheService.has('daily', cacheKey)) {
    return cacheService.get('daily', cacheKey);
  }

  try {
    const { data, error } = await supabase
      .from("ceb_data")
      .select("earnings");

    if (error) throw new Error(`Total earnings fetch failed: ${error.message}`);

    const totalEarn = data.reduce((sum, r) => sum + Number(r.earnings || 0), 0);

    const result = {
      total: totalEarn,
      timestamp: Date.now()
    };

    // Cache the result
    cacheService.set('daily', cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching total earnings data:', error);
    // Return cached data if available, even if expired
    const cached = cacheService.get('daily', cacheKey);
    if (cached) {
      console.warn('Using cached total earnings data due to fetch error');
      return cached;
    }
    throw error;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cacheService.getStats();
}