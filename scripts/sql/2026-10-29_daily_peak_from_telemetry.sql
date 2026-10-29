-- 2026-10-29_daily_peak_from_telemetry.sql
--
-- One-time correction: raise inverter_data_daily_summary.peak_power_kw to the day's highest
-- reading in inverter_telemetry wherever the stored peak is NULL or lower. DATA change, not schema.
--
-- WHY
-- GitHub delivers the every-5-minute "Fetch Live Inverter Data" schedule only a handful of times a
-- day (median gap 4.7 h, Oct 2026), so the daily summary's peak was the largest of 2-5 samples:
-- 5.12 kW stored against a real 33.52 kW on 2026-10-21. v3 shows it (Explore "best peak", CSV
-- peak_kw). inverter_telemetry holds SolisCloud's full 5-minute history for every day since
-- 2024-08-02. Every stored peak and every telemetry point is a real reading, so the honest daily
-- peak is the HIGHEST of them: this only raises, never lowers. Daily totals are untouched — they
-- matched telemetry on every day checked (21 of 21).
--
-- Going forward the nightly collector does the same (--fill-peaks, raise-only) and the daily
-- summary job never lowers a peak (shared/domain/dailySummaryMerge.js).
--
-- PLAUSIBILITY CAP
-- The S5-GC40K's maximum output power is 44 kW (datasheet in docs/, "Max. output power"; the 40 kW
-- is the rated output, and power_limit_pct reads 110). The highest telemetry reading is 43.78 kW,
-- with consistent AC current and voltage. A reading above 44 kW would be a glitch, so it is not
-- written.
--
-- SIZE (measured 2026-10-29, before applying): 810 summary days, all with telemetry; 609 raised,
-- 201 already at or above the telemetry peak, 0 NULL.
--
-- BEFORE: DB Snapshot workflow (the snapshot includes inverter_data_daily_summary). That artifact
-- is the rollback: the old values were samples, but they are restorable from it.
--
-- VERIFY (expect 0):
--   with t as (select inverter_sn, (ts at time zone 'Asia/Colombo')::date d,
--                     round(max(pac_kw)::numeric, 2) peak
--              from public.inverter_telemetry where pac_kw >= 0 group by 1, 2)
--   select count(*) from public.inverter_data_daily_summary s
--   join t on t.inverter_sn = s.inverter_sn and t.d = s.summary_date
--   where t.peak <= 44 and (s.peak_power_kw is null or s.peak_power_kw < t.peak);
--
-- Safe to run more than once (raise-only).

begin;

with t as (
  select inverter_sn,
         (ts at time zone 'Asia/Colombo')::date as d,
         round(max(pac_kw)::numeric, 2)         as peak
  from public.inverter_telemetry
  where pac_kw is not null and pac_kw >= 0
  group by 1, 2
)
update public.inverter_data_daily_summary s
set peak_power_kw = t.peak
from t
where t.inverter_sn = s.inverter_sn
  and t.d = s.summary_date
  and t.peak <= 44
  and (s.peak_power_kw is null or s.peak_power_kw < t.peak);

commit;
