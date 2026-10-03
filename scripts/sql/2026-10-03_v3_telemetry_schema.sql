-- v3 / P1 — telemetry, alarms, logger heartbeats, derived uptime, collector run log.
--
-- Issue #155. Design inputs: docs/SOLIS_API_FIELD_CATALOG.md, docs/logic-registry/LR-002.
--
-- PURELY ADDITIVE. Creates new tables only; no existing table is altered, so the running v1
-- dashboard and the existing pipelines are unaffected. Idempotent (IF NOT EXISTS everywhere).
--
-- PRIVATE FROM DAY ONE (decision D-2): row level security is enabled and NO policy is created,
-- and all privileges are revoked from anon/authenticated. Only the service_role key (API
-- functions and GitHub Actions) can read or write these tables. The browser reads through the
-- authenticated API (P3), never directly.
--
-- Apply order: take a DB Snapshot first (docs/WORKING_RULES.md §4), then run this file.
-- Rollback: scripts/sql/2026-10-03_v3_telemetry_schema_rollback.sql
--
-- Time conventions: instants are timestamptz (from Solis dataTimestamp, epoch ms); calendar days
-- are `date` in Asia/Colombo. Absence of a row means "unknown", never zero.

-- ---------------------------------------------------------------------------------------------
-- 1. 5-minute telemetry (source: Solis inverterDay). ~146 rows/day, ~115k rows for 2 years.
--    No raw JSON on purpose: 129 fields x 115k rows would be hundreds of MB, and the source
--    keeps >= 2 years of history, so anything not captured here can be re-fetched.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.inverter_telemetry (
  inverter_sn      text         not null,
  ts               timestamptz  not null,
  state            smallint,
  pac_kw           numeric(8,3),                 -- normalised to kW via pacPec/pacStr
  pv_v             numeric(7,1)[],               -- string voltages  uPv1..8  (null element = not reported)
  pv_a             numeric(6,1)[],               -- string currents  iPv1..8
  ac_v             numeric(6,1)[],               -- phase voltages   uAc1..3
  ac_a             numeric(6,1)[],               -- phase currents   iAc1..3
  fac_hz           numeric(5,2),
  power_factor     numeric(5,3),
  temp_c           numeric(5,1),
  dc_bus_v         numeric(6,1),
  power_limit_pct  smallint,
  e_today_kwh      numeric(8,1),
  e_total_kwh      numeric(12,1),
  primary key (inverter_sn, ts),
  constraint inverter_telemetry_pv_len check (pv_v is null or array_length(pv_v, 1) = 8),
  constraint inverter_telemetry_pva_len check (pv_a is null or array_length(pv_a, 1) = 8),
  constraint inverter_telemetry_ac_len check (ac_v is null or array_length(ac_v, 1) = 3)
);

-- ---------------------------------------------------------------------------------------------
-- 2. Logger heartbeats (source: Solis collector/day). Lets LR-002 tell "inverter off" from
--    "logger/WiFi down". Small rows; may be pruned after derivation (tracked separately).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.collector_heartbeats (
  collector_sn  text         not null,
  ts            timestamptz  not null,
  rssi          smallint,
  rssi_level    smallint,
  primary key (collector_sn, ts)
);

-- ---------------------------------------------------------------------------------------------
-- 3. Alarms (source: Solis alarmList, PAGINATED). Authoritative for grid trips and faults.
--    end_ts is NULL while the alarm is open (state 0). duration_ms is the API's alarmLong.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.inverter_alarms (
  inverter_sn   text         not null,
  alarm_code    text         not null,
  begin_ts      timestamptz  not null,
  end_ts        timestamptz,
  duration_ms   bigint,
  level         smallint,
  state         smallint,
  message       text,
  advice        text,
  updated_at    timestamptz  not null default now(),
  primary key (inverter_sn, alarm_code, begin_ts),
  constraint inverter_alarms_end_after_begin check (end_ts is null or end_ts >= begin_ts)
);
create index if not exists inverter_alarms_begin_idx on public.inverter_alarms (begin_ts desc);

-- ---------------------------------------------------------------------------------------------
-- 4. Derived per-day uptime (LR-002). uptime_pct NULL = not knowable (never 0 by default).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.inverter_day_uptime (
  inverter_sn       text         not null,
  day               date         not null,
  status            text         not null check (status in ('ok','down','no_data','no_window')),
  uptime_pct        numeric(5,2) check (uptime_pct is null or (uptime_pct >= 0 and uptime_pct <= 100)),
  window_start      timestamptz,
  window_end        timestamptz,
  window_minutes    numeric(7,1),
  point_count       integer      not null default 0,
  cadence_min       numeric(4,1),
  resolution_min    numeric(5,1),
  low_confidence    boolean      not null default false,
  alarms_known      boolean      not null default false,
  logger_known      boolean      not null default false,
  trip_min          numeric(7,1) not null default 0,
  gap_min           numeric(7,1) not null default 0,
  comms_lost_min    numeric(7,1) not null default 0,
  edge_gap_min      numeric(7,1) not null default 0,
  trip_count        integer      not null default 0,
  gap_count         integer      not null default 0,
  comms_lost_count  integer      not null default 0,
  computed_at       timestamptz  not null default now(),
  primary key (inverter_sn, day)
);

-- Non-producing stretches (LR-002 R3) for the timeline view.
create table if not exists public.inverter_status_segments (
  inverter_sn      text         not null,
  start_ts         timestamptz  not null,
  end_ts           timestamptz  not null,
  kind             text         not null check (kind in ('trip','gap','comms_lost','edge_gap')),
  cause            text,
  alarm_code       text,
  logger_evidence  boolean,
  day              date         not null,
  primary key (inverter_sn, start_ts, kind),
  constraint inverter_status_segments_order check (end_ts > start_ts)
);
create index if not exists inverter_status_segments_day_idx on public.inverter_status_segments (day);

-- ---------------------------------------------------------------------------------------------
-- 5. Collector run log: every job run records what it did, so the freshness check and humans can
--    see "ran, wrote N" vs "did not run". A run that processed nothing is recorded as such.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.collector_runs (
  id              bigint generated always as identity primary key,
  job             text         not null,
  started_at      timestamptz  not null default now(),
  finished_at     timestamptz,
  status          text         not null default 'running' check (status in ('running','ok','empty','failed')),
  date_from       date,
  date_to         date,
  points_written  integer      not null default 0,
  alarms_written  integer      not null default 0,
  days_derived    integer      not null default 0,
  error           text
);
create index if not exists collector_runs_started_idx on public.collector_runs (started_at desc);

-- ---------------------------------------------------------------------------------------------
-- 6. Private by default: RLS on, no policies, no privileges for the public roles.
-- ---------------------------------------------------------------------------------------------
alter table public.inverter_telemetry        enable row level security;
alter table public.collector_heartbeats      enable row level security;
alter table public.inverter_alarms           enable row level security;
alter table public.inverter_day_uptime       enable row level security;
alter table public.inverter_status_segments  enable row level security;
alter table public.collector_runs            enable row level security;

revoke all on public.inverter_telemetry        from anon, authenticated;
revoke all on public.collector_heartbeats      from anon, authenticated;
revoke all on public.inverter_alarms           from anon, authenticated;
revoke all on public.inverter_day_uptime       from anon, authenticated;
revoke all on public.inverter_status_segments  from anon, authenticated;
revoke all on public.collector_runs            from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Settings seed: the array's DC size (Solis stationDetail.capacity = 41.76 kWp) is needed for
--    specific yield; the existing solar_grid_capacity (40) is the AC rating and stays.
--    Inserted only if absent. NOTE: anon can still SELECT system_settings until cutover (V3-D1).
-- ---------------------------------------------------------------------------------------------
insert into public.system_settings (setting_name, setting_value)
select 'capacity_kwp', '41.76'
where not exists (select 1 from public.system_settings where setting_name = 'capacity_kwp');
