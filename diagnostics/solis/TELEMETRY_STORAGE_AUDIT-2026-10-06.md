# Production telemetry storage audit — 2026-10-06

This audit checks the existing `public.inverter_telemetry` rows used by the
proposed Pro electrical range view. Queries were read-only `SELECT`s in the
SolarEdge production Supabase SQL Editor on 2026-10-06. Dates below are
Asia/Colombo calendar dates. The project contained one distinct inverter in
this table at query time. No device identifier or raw row is retained here.

## Results

| Check | Observed result |
| --- | --- |
| Table span | 111,896 rows; first local date 2024-08-02, last local date 2026-10-05. The latest sample was 2026-10-05 18:06:37 local. |
| Latest 31 completed days, 2026-09-05 through 2026-10-05 | 4,845 rows across all 31 dates; 4,055 rows have `pac_kw > 1`. |
| Fields on those 4,055 producing rows | Every row had eight non-null PV current positions, eight non-null PV voltage positions, three non-null AC phase-voltage positions, and non-null frequency, power factor and temperature. |
| Full stored date span | 795 calendar dates; 787 have telemetry rows; 784 have at least one row with `pac_kw > 1`. |
| No telemetry | 2025-04-14 through 2025-04-21 inclusive (eight dates). The new API must mark these unknown, never zero. |
| Telemetry but no readings above 1 kW | 2025-11-28 through 2025-11-30 inclusive. This filter result does not establish why generation was low or absent. |
| Shape and field presence across full history | All 94,890 producing rows had arrays of eight PV current values, eight PV voltage values and three AC phase voltages, with no null array elements; all had non-null frequency, power factor and temperature. |
| Sampling density | Present dates range from 38 to 722 stored rows (median 137). The 722 rows on 2026-08-14 had 722 distinct timestamps. The latest 31-day window includes a 450-row date on 2026-09-28. |

The observed 31-day window is safely below the new repository reader's
20,000-row pagination limit. This audit has **not** established that every
possible custom 31-day window is below that limit. The reader throws on
overflow rather than returning a silently truncated result.

## Queries and interpretation

The production column check used `information_schema.columns` and confirmed
that `ts` is `timestamp with time zone`, `pac_kw`, `fac_hz`, `power_factor` and
`temp_c` are numeric, and `pv_a`, `pv_v`, `ac_v` are arrays. The local date
expression was `(ts at time zone 'Asia/Colombo')::date`.

The latest-window check bounded `ts` from Colombo midnight on 2026-09-05
(inclusive) to Colombo midnight on 2026-10-06 (exclusive), then counted rows,
distinct local dates and producing rows. Conditional counts checked
`array_length(..., 1)`, `array_position(..., null)` and scalar nulls on
producing rows. The full-history check grouped by local date, left-joined a
`generate_series` of dates from first to last, and distinguished missing dates
from dates with rows but no `pac_kw > 1` sample. A per-date query identified
the dates listed above. The dense-day query compared `count(*)` and
`count(distinct ts)` for dates above 250 rows.

These checks establish **stored row availability and field presence**, not
accuracy of the inverter's measurements or completeness against an external
meter. The proposed range card now exposes days without telemetry and days
without producing readings separately. It also states that whole-range
statistics weight dates by their number of stored producing readings, since
the cadence is uneven. The daily table supports date-by-date review.

## Release gate

Database coverage and field-shape checks pass for the latest 31 completed
days. A draft Vercel preview was deployed on 2026-10-06, but its standard
`vercel.app` host cannot use this project's Clerk production key: Clerk
rejected the origin because the key is restricted to `solaredge.anujajay.com`.
The preview also revealed an initial-render bug in the month comparison;
that has been fixed and given a regression test. No credential or origin
protection was weakened to work around the preview restriction.

Keep the electrical-history feature off production until an authenticated
test on an allowed host calls the new `/api/data/electrical` endpoint against
this database and confirms its date boundaries, pagination and missing-day
responses. The endpoint is not deployed on the current production site, so
this audit cannot claim that end-to-end check has passed. Recheck the latest
31-day counts immediately before release; the production table changes daily.
