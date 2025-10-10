import { supabase } from './supabaseClient'

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

export async function getMonthlyData() {
  const [{ data: ceb, error: cebError }, { data: inv, error: invError }] = await Promise.all([
    supabase.schema(schema).from(cebTable).select('bill_date,units_exported,earnings'),
    supabase.schema(schema).from(inverterTable).select('date,generation_kwh,earnings,rate_per_kwh'),
  ])
  if (cebError) throw new Error(`Fetch ${schema}.${cebTable} failed: ${cebError.message}`)
  if (invError) throw new Error(`Fetch ${schema}.${inverterTable} failed: ${invError.message}`)
  return aggregateMonthly(ceb || [], inv || [])
}

export async function getYearlyData() {
  const [{ data: ceb, error: cebError }, { data: inv, error: invError }] = await Promise.all([
    supabase.schema(schema).from(cebTable).select('bill_date,units_exported,earnings'),
    supabase.schema(schema).from(inverterTable).select('date,generation_kwh,earnings,rate_per_kwh'),
  ])
  if (cebError) throw new Error(`Fetch ${schema}.${cebTable} failed: ${cebError.message}`)
  if (invError) throw new Error(`Fetch ${schema}.${inverterTable} failed: ${invError.message}`)
  return aggregateYearly(ceb || [], inv || [])
}


