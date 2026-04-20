import { supabase } from './supabaseClient'
import { cacheService } from './cacheService'
import { formatDateDDMMYYYY } from './dateFormatter'

const schema = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'
const cebTable = import.meta.env.VITE_SUPABASE_TABLE_CEB || 'ceb_data'
const inverterTable = import.meta.env.VITE_SUPABASE_TABLE_INVERTER || 'inverter_data'
const shortMonthFormatter = new Intl.DateTimeFormat('en', { month: 'short' })

function toDateOnly(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function formatShortDate(value) {
  return formatDateDDMMYYYY(value, 'Unknown')
}

function addDays(value, days) {
  const date = toDateOnly(value)
  if (!date) return null
  date.setDate(date.getDate() + days)
  return date
}

function isSameOrAfter(date, compare) {
  const left = toDateOnly(date)
  const right = toDateOnly(compare)
  if (!left || !right) return false
  return left.getTime() >= right.getTime()
}

function isSameOrBefore(date, compare) {
  const left = toDateOnly(date)
  const right = toDateOnly(compare)
  if (!left || !right) return false
  return left.getTime() <= right.getTime()
}

function sumDailyGeneration(rows, startDate, endDate) {
  if (!startDate || !endDate) return null
  return rows.reduce((sum, row) => {
    if (isSameOrAfter(row.summary_date, startDate) && isSameOrBefore(row.summary_date, endDate)) {
      return sum + Number(row.total_generation_kwh || 0)
    }
    return sum
  }, 0)
}

function buildAlignedEnergyComparisonRows(year, dailyRows, cebRows, today = new Date()) {
  const selectedYear = Number(year) || today.getFullYear()
  const currentYear = today.getFullYear()
  const currentMonthIndex = today.getMonth()
  const normalizedToday = toDateOnly(today)
  const sortedBills = [...(cebRows || [])].sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date))

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthDate = new Date(selectedYear, monthIndex, 1)
    const monthStart = toDateOnly(monthDate)
    const monthEnd = toDateOnly(new Date(selectedYear, monthIndex + 1, 0))
    const monthLabel = shortMonthFormatter.format(monthDate)

    const mappedBillMonth = (monthIndex + 1) % 12
    const mappedBillYear = selectedYear + (monthIndex === 11 ? 1 : 0)
    const bill = sortedBills.find((entry) => {
      const billDate = toDateOnly(entry.bill_date)
      return billDate
        && billDate.getMonth() === mappedBillMonth
        && billDate.getFullYear() === mappedBillYear
    }) || null

    const isCurrentMonth = selectedYear === currentYear && monthIndex === currentMonthIndex
    const isFutureMonth = selectedYear > currentYear || (selectedYear === currentYear && monthIndex > currentMonthIndex)

    if (bill) {
      const billDate = toDateOnly(bill.bill_date)
      const currentBillIndex = sortedBills.findIndex((entry) => entry.bill_date === bill.bill_date)
      const previousBill = currentBillIndex > 0 ? sortedBills[currentBillIndex - 1] : null
      const periodStart = previousBill ? addDays(previousBill.bill_date, 1) : addDays(billDate, -30)
      const periodEnd = billDate
      const inverter = sumDailyGeneration(dailyRows, periodStart, periodEnd)

      return {
        month: monthLabel,
        period: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
        inverter,
        ceb: Number(bill.units_exported || 0),
        periodLabel: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
        status: 'finalized',
        periodStart: periodStart ? periodStart.toISOString().split('T')[0] : null,
        periodEnd: periodEnd ? periodEnd.toISOString().split('T')[0] : null,
        billDate: bill.bill_date
      }
    }

    if (isCurrentMonth) {
      const latestBill = sortedBills.length > 0 ? sortedBills[sortedBills.length - 1] : null
      const latestBillDate = latestBill ? toDateOnly(latestBill.bill_date) : null
      const provisionalStart = latestBillDate ? addDays(latestBillDate, 1) : monthStart
      const periodStart = provisionalStart && monthStart && provisionalStart.getTime() > monthStart.getTime() ? provisionalStart : monthStart
      const periodEnd = normalizedToday && monthEnd && normalizedToday.getTime() < monthEnd.getTime() ? normalizedToday : monthEnd
      const inverter = sumDailyGeneration(dailyRows, periodStart, periodEnd)

      return {
        month: monthLabel,
        period: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
        inverter,
        ceb: null,
        periodLabel: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
        status: 'provisional',
        periodStart: periodStart ? periodStart.toISOString().split('T')[0] : null,
        periodEnd: periodEnd ? periodEnd.toISOString().split('T')[0] : null,
        billDate: null
      }
    }

    if (isFutureMonth) {
      return {
        month: monthLabel,
        period: 'Pending',
        inverter: null,
        ceb: null,
        periodLabel: 'Pending',
        status: 'pending',
        periodStart: null,
        periodEnd: null,
        billDate: null
      }
    }

    const inverter = sumDailyGeneration(dailyRows, monthStart, monthEnd)

    return {
      month: monthLabel,
      period: `${formatShortDate(monthStart)} – ${formatShortDate(monthEnd)}`,
      inverter,
      ceb: null,
      periodLabel: `${formatShortDate(monthStart)} – ${formatShortDate(monthEnd)}`,
      status: 'missing_bill',
      periodStart: monthStart ? monthStart.toISOString().split('T')[0] : null,
      periodEnd: monthEnd ? monthEnd.toISOString().split('T')[0] : null,
      billDate: null
    }
  })
}

export async function getAlignedEnergyComparisonData(year = new Date().getFullYear(), forceRefresh = false) {
  const selectedYear = Number(year) || new Date().getFullYear()
  const cacheKey = `energy_comparison_${selectedYear}`

  if (!forceRefresh && cacheService.has('monthly', cacheKey)) {
    return cacheService.get('monthly', cacheKey)
  }

  const dailyStart = `${selectedYear - 1}-12-01`
  const dailyEnd = `${selectedYear + 1}-01-31`

  const [{ data: dailyRows, error: dailyError }, { data: cebRows, error: cebError }] = await Promise.all([
    supabase
      .from('inverter_data_daily_summary')
      .select('summary_date, total_generation_kwh')
      .gte('summary_date', dailyStart)
      .lte('summary_date', dailyEnd)
      .order('summary_date', { ascending: true }),
    supabase
      .from('ceb_data')
      .select('bill_date, units_exported')
      .gte('bill_date', dailyStart)
      .lte('bill_date', dailyEnd)
      .order('bill_date', { ascending: true })
  ])

  if (dailyError) throw new Error(`Aligned inverter data fetch failed: ${dailyError.message}`)
  if (cebError) throw new Error(`Aligned CEB data fetch failed: ${cebError.message}`)

  const result = buildAlignedEnergyComparisonRows(selectedYear, dailyRows || [], cebRows || [], new Date())
  cacheService.set('monthly', cacheKey, result)
  return result
}

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
  return getAlignedEnergyComparisonData(new Date().getFullYear(), forceRefresh)
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