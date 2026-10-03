# UI Current-State Audit

**Date:** 2026-10-03
**Scope:** the user-facing frontend only (not the admin CEB pipeline UI, not the API).
**Purpose:** record what the dashboard shows today, from where, and what is wrong with it —
*before* deciding what it should show. Nothing here is a decision. Decisions go in a follow-up
to `UI_REDESIGN_DIRECTION.md`.

Method: read every component, context and data function the dashboard routes render. Claims
about what a figure *is* come from the code, not from the label on the card.

---

## 1. Routes: three dashboards, not one

| Route | Renders | Notes |
|---|---|---|
| `/`, `/dashboard` | `DashboardReal` → `Dashboard.jsx` ("v1") | Production. Needs login **and** `dashboardAccess === 'real'` |
| `/dashboard/v2` | `DashboardV2.jsx` | Preview of the redesign, same gate. Already wired to real data |
| `/demodashbaard` *(sic)* | `DashboardDemo` → **same** `Dashboard.jsx` + fake `DemoDataContext` | Typo is in the URL and in 5+ redirect buttons |
| `/settings`, `/demosettings` | Settings (tariff, capacity, target, theme) | |
| `/access`, `/login`, `/signup`, `/admin/*` | Auth / admin | Out of scope |
| *(not routed)* | `Reports.jsx` | "Coming soon" placeholder. Dead file |
| *(ops overlay)* | `SolisExplorer` (1,989 lines) | Admin/real-access dev panel, opens over the app. Has the **only** inverter health / uptime / alarm view |

Navigation is a 60px icon sidebar (desktop) / bottom bar (mobile): Dashboard, Settings, theme
toggle, admin, dev tools. No "Reports", no period navigation.

---

## 2. What v1 (`/dashboard`) shows — nine widgets

Layout: 3 stat cards → 2 live widgets → 1 big chart → 3 secondary cards.

| # | Widget | What it displays | Actual source | Honest description |
|---|---|---|---|---|
| 1 | **Monthly Generation Total** | kWh/MWh + "Start: dd/mm/yyyy" | Sum of `inverter_data_daily_summary` from *latest bill date + 1* to today | **Billing-period-to-date**, not a month. Label is wrong. |
| 2 | **All-Time Generation** | MWh/kWh | Solis live API `totalGeneration` | Lifetime inverter total (includes time before any bill) |
| 3 | **Total Earnings (CEB_Total)** | LKR | `SUM(ceb_data.earnings)` | Lifetime CEB payments, 25 bills (Sep 2024 →) |
| 4 | **Daily Generation** | Animated liquid-fill circle, % of target, kWh, target | Solis live `dailyGeneration` ÷ `system_settings.daily_generation_target` (default 150) | Today's progress. Waves, bubbles, sparkles, 30ms `setInterval` re-render |
| 5 | **Live Power** | Speedometer dial 0–40 kW, Online/Offline dot | Solis live `currentPower` ÷ `solar_grid_capacity` | Instant power. Needle + gradient arc + glow |
| 6 | **Monthly Energy Summary** | 12 months × (Inverter, CEB) kWh | `buildAlignedEnergyComparisonRows` (LR-001) | **The product.** Bar chart **and** an identical line chart below it. "Ruler" slider (0–7000, default 3700, saved in localStorage). Year ‹ ›. Mobile: swipe cards or chart |
| 7 | **Potential vs. Actual Earnings** | Two LKR totals, needle gauge, difference, warning box | `totalGeneration × tariff` vs `SUM(ceb_data.earnings)` | See §5 — comparison is not like-for-like |
| 8 | **Environmental Impact** | CO₂ avoided, trees | `totalGeneration × 0.984`, `÷ 220` (both from `system_settings`) | Pulsing heart icon |
| 9 | **Billing Period Generation** | Area chart of daily kWh **and** peak kW on one axis; Total, Daily Avg, Max Peak, Best Day | `inverter_data_daily_summary` for the same window as #1 | X-axis labels hidden until hover, 7px font |

Plus chrome: `RefreshIndicator`, `ErrorBanner`, `AuthErrorModal`, `GoToTopButton`, skeletons.

### Analytics actually computed

Only these are derived anywhere — everything else is a raw figure:

1. **Billing-period alignment** — inverter sum vs CEB `units_exported` per bill (LR-001). *Good.*
2. **Potential value** — lifetime kWh × *today's* tariff.
3. **Potential − actual** difference (LKR), plus a ±10% needle.
4. **Period stats** — total, daily average, best day, max peak (billing-period-to-date only).
5. **Daily target %**.
6. **CO₂ / tree equivalents.**

Not computed anywhere in v1: per-month **variance** (kWh or %), **effective rate** (LKR per
kWh actually paid), month-over-month or year-over-year change, specific yield (kWh/kWp),
performance against capacity, cumulative curves, projections.

---

## 3. What v2 (`/dashboard/v2`) adds

Already built, additive, reading real data:

- **Daily generation panel** — Day / Week / Month pills + ‹ › stepper. Day/Week: small-multiple
  cards of real `inverter_data_live` samples (not smoothed — the live table is sparse). Month:
  daily-total bars from the summary table.
- **Live gauges** — current power, today vs target, tariff.
- **Generation vs CEB** — Month/Year overlapping areas; Day disabled with an honest tooltip;
  "widest gap" callout.
- **Income comparison** — last finalised period (expected vs paid vs diff) and lifetime.
- **Weather strip** — Open-Meteo forecast (explanatory only, per D6/§7.2).
- **Environmental strip.**

v2 fixes the *look* and adds the first real time-navigation, but it is still **fixed windows**:
1/5/7 days, a calendar month, a calendar year, or a billing month. There is no way to say
"15 March → 2 April".

---

## 4. Data that exists vs. data that is shown

| Table | Columns | Shown today |
|---|---|---|
| `inverter_data_daily_summary` | `summary_date`, `total_generation_kwh`, `peak_power_kw` | Daily gen + peak, but **only** for the open billing period (v1) or a stepper window (v2) |
| `inverter_data_live` | `data_timestamp`, `power_ac`, `generation_today`, `raw_data` (jsonb) | v2 day cards only. `raw_data` (voltages, temperature, etc., if the API supplies them) is never surfaced |
| `inverter_data_monthly_summary` | — | Not read by any UI (`getMonthlyData` reads a different table, `inverter_data`, and is itself never called) |
| `ceb_data` | `bill_date`, `billing_period_start/end`, `units_exported`, `earnings`, `meter_reading`, `account_number`, `billing_month` | Only `bill_date`, `units_exported`, `earnings`. **Meter reading, tariff-per-unit, any import/net figure: never shown** |
| `system_settings` | tariff, capacity, target, CO₂/tree factors, theme | Via Settings page |
| Solis live API | power, today, total, status | Four numbers |
| Inverter health | uptime, alarms, health score | **Admin dev-tools overlay only** (`SolisExplorer`) |

The two things an owner most plausibly wants and cannot get: **any arbitrary date range**, and
**the per-bill detail behind the 12-bar chart** (period, kWh both sides, variance, LKR, rate).

---

## 5. Problems

### 5.1 Correctness / honesty (these matter most — this project has been burned here)

1. **Fabricated zeros in the display layer** — the `null` ≠ `0` rule, broken at render time:
   - `monthlyGenerationData?.total || 0`, `totalEarningsData?.total || 0`,
     `livePowerData?.currentPower?.value || 0`, and `{ total: 0 }` as *initial state* for
     earnings, monthly gen, potential value, CO₂, trees.
   - If a fetch fails or is slow the user sees `0.0 kW`, `0 kWh`, `LKR 0` — indistinguishable from
     a real measured zero. Loading is partly masked with `"..."`, but **errors fall through to 0**.
   - Offline inverter ⇒ dial reads 0.0 kW and target tracker reads 0%, rather than "unknown".
2. **"Potential vs Actual" is not like-for-like.** Numerator: Solis *all-time* kWh × *today's*
   tariff. Denominator: the sum of 25 bills starting Sep 2024. The inverter total includes
   generation before the first bill and the current unbilled period, and the tariff has almost
   certainly changed over that time. The "Warning: possible accounting error" box is a symptom
   of this, not a finding. v2's *per-period* comparison is sound; the *lifetime* one carries the
   same flaw.
3. **"Monthly" is mislabelled** in two places (#1 above, and "Monthly Energy Summary", whose
   bars are bill periods). Contradicts the project's one rule in the UI's own copy.
4. **Three different default tariffs**: `|| 37` (DataContext), `'50'` (Settings seed),
   `* 50 // rough rate` (dead `getDashboardSummary`). Whichever fires silently drives
   "potential value".
5. **UTC date bug still live in v1**: `DataContext` uses `today.toISOString().split('T')[0]`
   for the period end. In Asia/Colombo between 00:00 and 05:30 that is *yesterday*, so today is
   excluded. (`toLocalIsoDate` exists and is tested; v1 doesn't use it.) `SystemTrends` has the
   same pattern three times.
6. **Mixed units on one axis**: daily kWh and peak kW share a single Y axis labelled "kW/kWh".
7. **Hard-coded plateau**: the "ruler" defaults to 3,700 kWh — a number with no explanation,
   persisted per-browser.

### 5.2 Redundancy

- Billing-period total appears twice (#1 and #9's "Total"), computed by two separate queries.
- #6 draws the same 12×2 values as a bar chart and again as a line chart.
- #4 and #5 both come from one live call; #2, #4, #5 are three views of "the inverter now".
- #3 and #7 both show lifetime CEB earnings.
- Three card components copy-paste the same ~25 lines of styles.

### 5.3 Missing for the stated goal

- **No custom range.** The one capability you named.
- No numbers-as-table view of any chart (analysis *and* accessibility).
- No export.
- No variance, no effective rate, no YoY.
- No bill-level drill-down.
- Health/uptime/alarms hidden behind an admin overlay, though the owner is the person who most
  needs "is it working".
- The reconciliation — the thing no vendor tool can show — is a bar chart in the middle of the
  page, with the variance left for the reader to eyeball.

### 5.4 Design / code debt (relevant because the redesign touches all of it)

- v1 is ~100% inline `style={{}}` objects with hard-coded hex (`#00c2a8`, `#ff7a00`, `#22c55e`…).
  v2 introduced `dv2-tokens.css`; v1 and v2 now carry **two token systems**.
- v1 colour mapping is teal = inverter, orange = CEB. `UI_REDESIGN_DIRECTION.md` D7 reverses it.
- Perpetual animation: wave `setInterval` at 30 ms (re-renders the component ~33×/s), bubbles,
  sparkles, pulsing heart, glow filters. Likely a contributor to the LCP/INP problems and
  battery drain on phones.
- Auth/permission screens are hand-rolled inline in `App.jsx` and `DashboardReal.jsx`, ×4.
- Duplicate `ErrorBoundary` and `SkeletonLoader` (root and `shared/`).
- Dead code: `Reports.jsx`, `ComingSoonNote`, 6 unused exports in `dataService.js`.
- 1,513-line `index.css` + per-component `<style>` tags.
- `localStorage` for chart ruler read without try/catch.

---

## 6. What this suggests (inputs to the next step, not decisions)

Grouping the nine widgets by the question each actually answers:

| Question | Today's widgets | Verdict to discuss |
|---|---|---|
| *Is it working right now?* | 4, 5 (+ hidden health) | Keep one compact "now" strip; merge; add health status |
| *How much did I make, over a period I choose?* | 1, 2, 9, (v2 daily panel) | **Replace with one range-driven panel** |
| *Did CEB pay me what the inverter made?* | 3, 6, 7 | **The core.** Per-bill table + variance + LKR; kill lifetime "potential" or make it honest |
| *What's my long-term picture?* | 2, 3, 8 | Small lifetime summary, once |
| *Context* | 8, weather | Optional / secondary |

Candidate removals: liquid-fill animation, speedometer needle gauge, the "Potential vs Actual"
needle gauge, the duplicate line chart, the ruler, the hearts/bubbles, the duplicate period
total, the lifetime potential-value calculation as currently defined.

---

## 7. Questions to settle before designing

1. **Who is the user?** Only the owner, or other people with "real" access (family, installer)?
   Changes how much explanation vs density.
2. **Custom range scope** — inverter generation only (easy: daily summary), or CEB too? CEB is
   billed per period, so a free range can only be compared to bills by *pro-rating*, which
   invents numbers. Proposal: free range = inverter only; the CEB comparison stays bill-aligned.
3. **Range outputs** — total, daily average, best/worst day, peak kW, LKR at a chosen tariff,
   daily bar chart, table, CSV export. Which of these?
4. **Intra-day detail** — do you want power-curve (kW over the day) for a chosen day? The live
   table is sparse, so this needs a decision on honest rendering (v2 already plots raw samples).
5. **Inverter health** — promote to the main dashboard, or leave in the admin overlay?
6. **Tariff** — one setting, or per-bill effective rate from `earnings ÷ units_exported`
   (more truthful for history)?
7. **Keep or drop**: weather, environmental impact, daily-target %, "all-time" totals.
8. **Demo mode** — keep (it's the same page with fake data), or retire with v1?
9. **Is v2 the base to build from or a reference?** Much of its data layer is already tested.
