// api/_lib/data/repo.js
//
// The real repository behind the read API: service-role Supabase queries returning plain,
// normalised values. Everything numeric leaves here as a number or null (PostgREST sends numeric
// columns as strings), and no row is ever fabricated.
//
// PostgREST caps a response at 1000 rows, so long ranges are paged; silently truncating a
// 3 000-day range at 1000 days would understate every total.

import { addDays, startOfLocalDayMs } from '../../../shared/domain/time.js';

const PAGE = 1000;
const MAX_PAGES = 20;

const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const dayStart = (key) => new Date(startOfLocalDayMs(key)).toISOString();

export function createRepo(supabase, inverterSn) {
  async function paged(build) {
    const out = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await build().range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      out.push(...data);
      if (data.length < PAGE) return out;
    }
    throw new Error('result exceeded the paging safety limit');
  }

  return {
    async dailyRows(from, to) {
      const rows = await paged(() =>
        supabase.from('inverter_data_daily_summary').select('summary_date,total_generation_kwh,peak_power_kw')
          .eq('inverter_sn', inverterSn).gte('summary_date', from).lte('summary_date', to).order('summary_date', { ascending: true })
      );
      return rows.map((r) => ({ date: String(r.summary_date).slice(0, 10), kwh: num(r.total_generation_kwh), peakKw: num(r.peak_power_kw) }));
    },

    async bills() {
      const rows = await paged(() => supabase.from('ceb_data').select('bill_date,units_exported,earnings').order('bill_date', { ascending: true }));
      return rows.map((r) => ({ bill_date: String(r.bill_date).slice(0, 10), units_exported: num(r.units_exported), earnings: num(r.earnings) }));
    },

    uptimeDays(from, to) {
      return paged(() =>
        supabase.from('inverter_day_uptime').select('*').eq('inverter_sn', inverterSn).gte('day', from).lte('day', to).order('day', { ascending: true })
      );
    },

    segments(from, to) {
      return paged(() =>
        supabase.from('inverter_status_segments').select('*').eq('inverter_sn', inverterSn).gte('day', from).lte('day', to).order('start_ts', { ascending: true })
      );
    },

    async alarms(from, to, limit) {
      const { data, error } = await supabase.from('inverter_alarms').select('*').eq('inverter_sn', inverterSn)
        .gte('begin_ts', dayStart(from)).lt('begin_ts', dayStart(addDays(to, 1)))
        .order('begin_ts', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return data;
    },

    async telemetryDay(date) {
      const { data, error } = await supabase.from('inverter_telemetry')
        .select('ts,state,pac_kw,pv_v,pv_a,ac_v,ac_a,fac_hz,power_factor,temp_c,dc_bus_v,power_limit_pct,e_today_kwh')
        .eq('inverter_sn', inverterSn).gte('ts', dayStart(date)).lt('ts', dayStart(addDays(date, 1))).order('ts', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },

    async settings() {
      const { data, error } = await supabase.from('system_settings').select('setting_name,setting_value');
      if (error) throw new Error(error.message);
      const m = Object.fromEntries(data.map((r) => [r.setting_name, r.setting_value]));
      // Missing or non-numeric stays null: a made-up default would silently skew every derived figure.
      return {
        ratePerKwh: num(m.rate_per_kwh),
        capacityKwp: num(m.capacity_kwp),
        acRatedKw: num(m.solar_grid_capacity),
        dailyTargetKwh: num(m.daily_generation_target)
      };
    }
  };
}
