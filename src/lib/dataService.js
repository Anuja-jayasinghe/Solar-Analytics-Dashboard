import { supabase } from './supabaseClient'
import { cacheService } from './cacheService'
import { formatDateDDMMYYYY } from './dateFormatter'

const shortMonthFormatter = new Intl.DateTimeFormat('en', { month: 'short' })

function toDateOnly(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

// Serialise a Date as YYYY-MM-DD using its LOCAL components.
//
// toDateOnly() returns a local-midnight Date. Calling .toISOString() on that converts to
// UTC, which rolls the date back a day for any timezone east of UTC — including
// Asia/Colombo (UTC+5:30), where this app runs. That made every periodStart/periodEnd
// reported by the alignment rule one day early. Caught by tests/energyAlignment.test.js.
function toLocalIsoDate(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  if (!Array.isArray(rows)) return 0
  return rows.reduce((sum, row) => {
    if (isSameOrAfter(row.summary_date, startDate) && isSameOrBefore(row.summary_date, endDate)) {
      return sum + Number(row.total_generation_kwh || 0)
    }
    return sum
  }, 0)
}

// Exported for tests: this is the LR-001 alignment rule, the core business logic of the
// dashboard. See tests/energyAlignment.test.js and docs/logic-registry/LR-001-*.md
export function buildAlignedEnergyComparisonRows(year, dailyRows, cebRows, today = new Date()) {
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
        periodStart: toLocalIsoDate(periodStart),
        periodEnd: toLocalIsoDate(periodEnd),
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
        periodStart: toLocalIsoDate(periodStart),
        periodEnd: toLocalIsoDate(periodEnd),
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
      periodStart: toLocalIsoDate(monthStart),
      periodEnd: toLocalIsoDate(monthEnd),
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
