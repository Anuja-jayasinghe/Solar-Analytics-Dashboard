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

## Release and authenticated production verification

The draft Vercel preview's standard `vercel.app` host could not use this
project's Clerk production key: Clerk rejected that origin because the key is
restricted to `solaredge.anujajay.com`. The preview also revealed an
initial-render bug in the month comparison; it was fixed with a regression
test. No credential or origin protection was weakened. The owner then
authorized a production-first test with rollback if a release check failed.

[PR #197](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/pull/197)
merged as `b575cd6` on 2026-10-06. Post-merge CI passed, Vercel reported a
successful production deployment, and `/healthz` and `/ready` both returned
`status: ok` with revision `b575cd6`; `/ready` also reported successful
Supabase and service-key-role checks. An unauthenticated request to
`/api/data/electrical` returned 401. The following checks used an authenticated
Admin session on the production Pro page around 06:38–06:43 UTC:

| Production check | Observed result |
| --- | --- |
| Custom 2026-09-05 through 2026-10-05 | 31/31 days with telemetry; the 31 daily rows summed to **4,845 stored** and **4,055 producing** samples, exactly matching the independent pre-release SQL audit. The first row was 134 of 152 on Sep 5; the last was 126 of 147 on Oct 5. This crosses multiple 1,000-row PostgREST pages. |
| Preset 30 days, 2026-09-06 through 2026-10-05 | 30/30 days; 4,693 stored and 3,921 producing samples, consistent with removing the Sep 5 row from the audited 31-day window. |
| Custom 2025-04-10 through 2025-04-25 | 8/16 days with telemetry. Apr 14–21 each said `No telemetry`; their electrical cells were dashes, not measured zeros. The range note explicitly said those days were unknown. |
| Custom 2025-11-28 through 2025-11-30 | 3/3 days with telemetry, all three labeled `No producing readings`; electrical cells were dashes. The note did not infer a cause. |
| Other Pro controls | Switching uptime from 30 to 14 days changed uptime/alarm figures while the electrical custom range stayed Nov 28–30. The alarm guide explained the observed 1011, 1010 and 1D4C2 codes. Choosing a different month changed the calendar-month comparison and its day-coverage counts. |
| Browser errors | No error-level console entries after these interactions. |

These checks clear the release gate for the **tested production windows**;
rollback was not needed. They do not establish that every possible custom
31-day window stays below the 20,000-row paging safety limit, or that stored
measurements match an independent meter. The physical PV string map remains
unknown, so low-current inputs are not identified as faults from this view.
