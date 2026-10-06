# v3 UI design (signed off 2026-10-04)

The agreed design for the v3 frontend (issue #159). Implementation is #160 and follows this file.
Live artifact (private, owner only): https://claude.ai/artifact/6yRRHcJBgkHh1GA4bmB2Mg

Everything on the boards uses **demo data dated 2035 onwards** from `shared/demo/`, so no real figure
is in the design. Behaviour on the boards is a prototype, not production code.

## What is in this folder

| Path | What |
|---|---|
| `boards/*.dc.html` | The artboards exactly as published (Design canvas format). Open them by re-publishing to a Design canvas, or read them as the reference markup. |
| `boards/canvas.json` | Canvas index: board positions and titles. |
| `source/` | The editable parts the boards were generated from (`theme.css`, one `.html` per page, `script.js`) plus the two scripts that build the demo data and the build scripts. `main_data.json` / `extra_data.json` are the generated demo figures. |

Regenerate: `node source/demo_main_data.mjs > main_data.json`, `node source/demo_extra_data.mjs`, then
`node source/build_v4.cjs <folder>` and `node source/build_boards.cjs`. The scripts expect a working
folder holding the data files and a `design2/project/` output folder; they were run from a scratch
directory, so adjust paths if re-running.

## Boards

Desktop (1440 wide): **Overview**, **Pro metrics**, **Sign in**, **Admin**.
Phone (390 wide): **Overview dark** and **light** (true 390x844 frames), **Pro metrics**, **Admin**, **Sign in**.
Settings is a page inside every board (sidebar), not a separate board.

## Decisions

**Look.** Dark first, polished light second. Palette "Sunrise on Navy": orange is the main colour
(generation), sky blue is CEB, amber is a warning/lowest, green/red only for health. Frosted glass
(blur 30, saturate 170), fonts Sora (numbers, headings) and Manrope (text).

**Themes are variables.** Every colour is a CSS variable in `source/theme.css`. `[data-theme="dark"]`
and `[data-theme="light"]` are two blocks of the same tokens. A new theme is another block plus a card
in Settings > Appearance; no screen changes. Components may only read tokens, never a literal colour.

**Overview, in order**
1. Three totals: this billing period, all-time generation, all-time earnings.
2. Today (filler toward the daily target, peak kW and when, faint data-freshness ring) and live power
   (0-40 kW arc gauge, online bulb).
3. CEB vs Inverter: bars/lines/area, 8/12/all periods, step back and forth, partial periods striped,
   open period "awaiting bill", variance per period, a draggable "Mark above" line, and the
   **money gap** strip (LR-004: CEB paid minus the generation's worth at each bill's own rate; negative
   means CEB paid less).
4. Inverter generation over time: week/month/year/custom, area (default)/line/bars, step through time,
   draggable "Mark above" line, year view groups by month.
5. Generation through the day: pick a day, kWh per hour.
6. Statistics: average per day, best day, lowest day, drawn on one range chart. Nothing else; total,
   specific yield, capacity factor, estimated earnings and days-above were removed on purpose.
No new analytics beyond what v1 showed, only better presented. Environmental impact is gone.

**Pro metrics** (admin and viewers; visitors see the demo version): health rings (uptime, time stopped,
open alarms, data completeness), uptime by day, alarm history (lost-internet alarms are logger events,
never downtime), data and logger, electrical readings (unmapped PV input current, temperature,
grid frequency, separate AC phase voltages, power factor), per-bill effective rate, year over year.
The PV input display makes no string-fault claim until the physical wiring is known.
Tiny optional weather chip.
"Revenue lost to downtime" was considered and **dropped**.

**Sidebar.** Full page height, collapses to icons, only: Overview, Pro metrics, Admin (admin only),
Settings, account. The theme switch is in the header and in Settings. On a phone it becomes a bottom tab bar.

**Admin.** Tabs: Bills (upload, check queue, approved bills), Access (invite viewers), Data health
(nightly runs, maintenance buttons that open the matching workflow, dry run first).

**Doorway.** Visitors see every page on demo data. "Sign in" is Clerk. Roles: Visitor (demo), Viewer
(real data, read only, Pro metrics), Admin. Matches decisions D-1..D-12 in `docs/V3_REFACTOR_PLAN.md`.

**Phone Overview.** A dedicated compact layout, not a squashed desktop: hero card (today + live) and a
3-up totals row and the CEB chart all in the first 844 px; the three Explore tiles become one tile with
tabs (Generation | Day | Stats). Elements are about half desktop size. The "Mark above" handle is the
only draggable part (a drag on the chart would block scrolling).

## Rules the build must keep (from `docs/WORKING_RULES.md`)
- Unknown is never zero: missing days draw as a grey mark or "n/a", never 0.
- Dates are `YYYY-MM-DD` keys in Asia/Colombo; bill N reports N-1 (LR-001).
- Every LKR figure states its basis (each bill's own rate by default); never today's tariff for history.
- Tooltips need a touch equivalent (tap to show) in the build; the board only has hover.
- Charts also need a table view for accessibility; real `<button>`s with labels throughout.

## Build notes for #160
- Responsive: one set of screens. Breakpoint around 700 px switches the sidebar to a bottom bar and the
  Overview to the compact phone layout.
- Data comes from `GET /api/data/*` (and the demo equivalent), never from Supabase in the browser.
- The gauge/filler/charts in the boards are plain SVG/CSS; the build may use Recharts or plain SVG, but
  the look (rounded bars, area fill, dashed threshold) is the spec.
- Logic already in `shared/`: LR-001 alignment, LR-002 uptime, LR-003 range stats, LR-004 earnings
  difference. The UI only formats these results.
