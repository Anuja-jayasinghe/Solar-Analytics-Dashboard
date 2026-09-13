# UI Redesign Direction

**Status:** Decided, not yet implemented — all open questions resolved 2026-09-13
**Date:** 2026-09-13
**Baseline:** `v2.1.0` — the last known-good state before this work begins
**Trigger:** The dashboard reads as 2020-era. A competitive teardown of SolisCloud v4 was run
to decide what to take, what to adapt, and what to deliberately refuse.

This is a decision record. It exists so the redesign is executed against reasoning that was
written down, rather than against a memory of a dashboard someone looked at once.

---

## 1. What was examined

SolisCloud v4 — the inverter vendor's own monitoring platform — running against **this
project's own plant** (CN00079, 40 kW, Sri Lanka), so every screen showed real comparable data
rather than a marketing demo.

| Surface | URL |
|---|---|
| Plant Overview (fleet list) | `v4.soliscloud.com/overview/plantStation` |
| Plant detail — Overview | `…/details/overview/{plantId}` |
| Plant detail — Device | `…/details/device/{plantId}` |
| Legacy platform | `www.soliscloud.com` (reached via the theme switcher) |

Both themes were inspected. Colour values below were read off screenshots and are
**approximate** — they describe relationships (how far apart the surface levels sit), not exact
vendor tokens.

---

## 2. Findings

### F1 — The vendor classifies flat-light as *the old version*

The single most decision-relevant discovery. v4's theme switcher offers **"Light V1"** and
**"Dark"**. Selecting Light V1 does not restyle v4 — it **redirects to the legacy platform** at
`www.soliscloud.com` and surfaces a "Back to Old Version" button.

The legacy look is: white page, white cards, 1px hairline borders, uniform corner radii, evenly
weighted rows, blue-grey isometric clip-art.

That is a near-exact description of this project's current UI. The vendor's own redesign was a
migration *away* from it — which independently corroborates the premise that prompted this
work, from a team with far more usage data than we have.

### F2 — Depth replaces borders

v4 separates regions with **stacked surface luminance**, not strokes. Three levels are visible:

```
page          near-black
  card        one step lighter, border barely perceptible
    tile      one step lighter again (the stat tiles inside "Operating Data")
```

This project does the opposite — nearly every region is delimited by
`1px solid var(--border-color)`. This is the largest single contributor to the dated feel, and
it is cheaper to change than anything else on this list.

### F3 — The hero is a live system diagram, not a number

The plant detail page opens with an isometric house, PV and Grid nodes, and connecting flow
lines with values attached. It answers *"what is my system doing right now"* before any text is
read. Numeric panels sit below it, not above.

### F4 — Energy and money are always paired

Every KPI on the overview shows both dimensions stacked:

```
130.8 kWh          2,002 MWh          98,754 MWh
Daily Yield        Monthly Yield      Total Yield
4,839K LKR         74,085K LKR        3,653M LKR
Daily Earning      Monthly Earning    Total Earning
```

The vendor treats "how much did it make" as inseparable from "how much did it generate".

### F5 — One card, two dimensions, auto-rotating

The earnings card on the plant detail page **cycles on a timer** between a currency face (coin
illustration, LKR) and an energy face (bar-chart illustration, MWh), with a two-dot carousel
indicator. Same footprint, twice the information.

### F6 — A single time-granularity control governs an entire panel

A `‹ 13/09/2026 ›` date stepper plus a `Day | Month | Year | Lifetime` segmented control,
sitting in the panel header and driving the stat tiles *and* both charts beneath it. One
control, one mental model, no per-chart pickers.

### F7 — Context that is not data

Three panels carry no telemetry at all:

- a **photograph of the actual inverter on the wall**, with GPS coordinates overlaid
- a **7-day weather forecast** with temperature, sunrise/sunset, wind, humidity
- **Environmental Benefits** — equivalent trees, CO2 reduced, coal saved

These are what make the page read as *your installation* rather than a database view.

### F8 — Colour is spent, not sprayed

The interface is overwhelmingly neutral. Cyan marks interactive and active state. The PV curve
is yellow — which reads as "sun" without a legend. Tariff series are cyan and blue. That is the
entire palette.

### F9 — The plant list is fleet-management UI

14+ sortable columns, horizontal scroll, ~10px labels, a filter row with four dropdowns, and
status tabs with counts (`Total(1) Online(0) Alarm(0) Offline(1)`). Built for installers
managing hundreds of plants. Rendering it for a single plant is absurd — `Total 1` with a
pagination control beneath it.

### F10 — Navigation is three levels deep

Primary sidebar (Overview / O&M / Report / Service) → secondary sidebar (Overview / Layout /
Info / Device / Alarm / Alert / Tariff) → tab strip (Inverter / Battery / Datalogger / EPM /
Grid Cabinet / Weather Station / Meter). Three levels to reach one inverter.

### F11 — Typography is the weakest part

Dense 10–11px grey labels on dark surfaces throughout. Numeric formatting is inconsistent and
occasionally ambiguous: `130,8kWh` uses a decimal comma while `4,839K LKR` uses a thousands
comma, in the same viewport.

### F12 — v4 has no light theme

Per F1, "light" means "the old application". A v4 user who prefers light is sent back to the
previous generation of the product.

---

## 3. Decisions

| # | Finding | Decision | Why |
|---|---|---|---|
| D1 | F2 depth over borders | **Adopt** | Largest visual gain per unit of effort |
| D2 | F3 system-diagram hero | **Adapt** | Take the principle, change the subject |
| D3 | F4 energy + money paired | **Adopt** | We already compute both; we show them apart |
| D4 | F5 rotating KPI card | **Reject** | Hides half a comparison on a timer |
| D5 | F6 unified time control | **Adopt, with a caveat** | Fixes a real weakness in the current charts |
| D6 | F7 non-data context | **Adopt selectively** | Photo and weather yes; env. metrics already exist |
| D7 | F8 restrained colour | **Adopt discipline, keep our hues** | Our orange is stronger than their cyan |
| D8 | F9/F10 fleet IA, deep nav | **Reject** | We have one inverter |
| D9 | F11 typography | **Reject and invert** | We hold Lighthouse a11y 100 |
| D10 | F12 no light theme | **Reject** | We ship a real light theme and keep it |

### D1 — Adopt depth, retire borders

Move to a three-level surface scale separated by luminance. `--border-color` survives only for
genuine dividers *inside* a surface (table row rules), never as the thing that makes a card a
card.

### D2 — Adapt the hero; change what it depicts

SolisCloud's hero is a house because SolisCloud only knows the inverter side. **It is
structurally incapable of showing what this project exists to show.**

Our hero is the reconciliation:

```
┌──────────────────────────────────────────────────────────┐
│  August 2026            5 Aug – 3 Sep                    │
│                                                          │
│     Inverter generated          4,180 kWh                │
│     CEB paid for                4,007 kWh                │
│     ────────────────────────────────────                 │
│     Variance                     −173 kWh   (4.1%)       │
│                                                          │
│     [ ▁▃▅▇█▇▅▃▁ daily generation across the period ]      │
│                                                          │
│  Period from bill dates, not calendar months — LR-001    │
└──────────────────────────────────────────────────────────┘
```

No vendor dashboard can render this. It is the product.

The variance figure carries semantic colour (D7) and must never be a bare number: a positive
variance and a negative one mean very different things to the owner.

### D3 — Pair energy and money everywhere

Every generation figure gets its earnings counterpart in the same component, at the same time
granularity.

The tariff comes from the bill where the bill states it, falling back to
`system_settings.rate_per_kwh` — **the same precedence the extractor's validator already
uses**, so the dashboard and the validator can never disagree about what a period was worth.

### D4 — Reject the rotating card

It looks clever and fails three ways here:

1. **It hides data behind time.** A user glancing at the page sees whichever face happens to be
   showing. On a page whose entire purpose is *comparison*, hiding half the comparison on a
   timer is self-defeating.
2. **It is an accessibility failure.** Auto-rotating content with no pause control fails
   WCAG 2.2.2. We are at 100 and intend to stay there.
3. **We lack the space pressure that motivates it.** Solis is fitting a fleet product into a
   fixed panel. We have one plant and room to show both.

Where both dimensions matter, show both. D3 makes that the default rather than the exception.

### D5 — One time control per panel

A `Day | Month | Year | Lifetime` segmented control plus a period stepper in the panel header,
driving every tile and chart within that panel.

**With one caveat that is ours alone: `Month` must mean the bill period, not the calendar
month.** Labelling a bill-derived window "August" while it actually covers 5 Aug – 3 Sep is
precisely the LR-001 error the entire system exists to avoid. The control names the
granularity; the header states the real date span.

### D6 — Adopt the human context, selectively

*Resolved 2026-09-13 — see §7.*

- **Installation photo** — **rejected.** Not wanted.
- **Weather** — **adopted, with a hard constraint.** Open-Meteo, validated against 242 days of
  this plant's own output (§7.2). It may explain, it may never compare.
- **Environmental benefits** — already present in this project. Restyle, do not re-derive.

### D7 — Keep our palette, borrow the discipline

Adopt the restraint, not the hues. `--accent: #ff7a00` is more distinctive than their cyan and
reads as "solar" without assistance. We already carry their teal as `--accent-secondary:
#00c2a8`.

**Role assignment for the product UI:**

| Role | Token | Rationale |
|---|---|---|
| Generation / inverter / PV | `--accent` orange | Reads as sun instantly — the role their yellow curve plays |
| CEB / billing / money | `--accent-secondary` teal | Cool, financial, maximally distinct from orange |
| Variance favourable | success green | Semantic, not brand |
| Variance unfavourable | warning amber | Semantic, not brand |

> **This reverses the mapping used in `docs/ARCHITECTURE.md` and the published Field Manual**,
> where orange denotes CEB and teal the inverter. That choice was arbitrary and made for a
> document; this one is not — in a product UI the sun/orange association is too strong to fight.
> Those documents will be reconciled to this mapping when the redesign lands. Recorded here so
> the discrepancy is a known, dated decision rather than a future bug report.

Semantic colour never doubles as brand accent.

### D8 — Refuse the fleet information architecture

No plant list, no status-filter tabs, no pagination over one row, no three-level navigation.
The dashboard opens **on the plant**, because there is only one.

Their device tab strip (Inverter / Battery / Datalogger / EPM / Grid Cabinet / Weather Station
/ Meter) covers hardware this site does not have. One inverter, one meter.

### D9 — Typography as a deliberate strength

Body text no smaller than 14px; labels 12px and never below. Every foreground/background pair
checked against **its own surface level**, not against the page. Tabular numerals wherever
figures align in a column — already a convention in this codebase.

The `--on-accent: #241000` token added at v2.1.0 (6.99:1 on `#ff7a00`) stays. The redesign must
not reintroduce white text on orange.

---

## 4. Token system

Target shape. Exact values are the implementer's to tune; the **relationships** are the
decision.

```css
:root {
  /* Surfaces — three levels, separated by luminance, not strokes (D1) */
  --surface-page:  #faf8f5;
  --surface-card:  #ffffff;
  --surface-tile:  #f2eee8;

  /* Brand — unchanged from v2.1.0 */
  --accent:           #ff7a00;   /* generation / PV        */
  --accent-secondary: #00c2a8;   /* CEB / billing / money  */
  --on-accent:        #241000;   /* 6.99:1 — do not change */

  /* Semantic — never used as a brand accent */
  --variance-good: <green>;
  --variance-warn: <amber>;

  /* Borders survive only as dividers inside a surface */
  --divider: <low-contrast neutral>;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --surface-page: #0e0d0c;     /* warm-biased, not pure black */
    --surface-card: #171512;
    --surface-tile: #1f1c18;
  }
}

:root[data-theme="dark"] { /* same overrides, so the toggle wins in both directions */ }
```

Both themes get equal care (D10). The existing three-state theme handling — explicit
`data-theme`, plus the unstamped system default — is already correct and must be preserved.

---

## 5. Explicit non-goals

Recorded so they are not quietly reintroduced:

- **No multi-plant support.** One site, one inverter. Any UI implying otherwise is wrong.
- **No auto-rotating content** (D4).
- **No 3D isometric illustration set.** Vendor-commissioned assets; a well-drawn SVG system
  diagram achieves the intent at a fraction of the cost.
- **No accessibility regression.** Lighthouse a11y is 100 and is treated as a gate.
- **No new data.** This is a presentation change. The pipelines, the parser and LR-001 are not
  in scope.

---

## 6. Known dependency

Lighthouse Performance is **70**, with LCP 5.7s of which the overwhelming majority is *render
delay* — TTFB is a healthy ~900ms. 393 KiB of unused JavaScript sits behind that, and
`react-vendor` is 785 KiB.

This was deliberately deferred at v2.1.0 **because this redesign rewrites that render path**.
It is therefore in scope here and nowhere else. A redesign that ships without improving LCP has
missed its one free opportunity.

---

## 7. Resolved questions

All three open questions from the first draft were answered on 2026-09-13. The reasoning is
kept because two of the answers carry constraints that are easy to violate later.

### 7.1 Installation photo — dropped

Not wanted. D6 loses its photo element entirely; no Storage path, no RLS policy, no build
asset. The "this is *my* system" job falls to the reconciliation hero instead, which is a
better carrier for it anyway — it shows something true about this specific installation rather
than a picture of a box on a wall.

### 7.2 Weather — Open-Meteo, and it may explain but never compare

**Chosen:** [Open-Meteo](https://open-meteo.com). No API key, no signup, no attribution
requirement, CORS-enabled, free for non-commercial use. It returns `Asia/Colombo` correctly
(+19800s) and — unlike a general weather API — exposes **solar irradiance**
(`shortwave_radiation_sum`, `direct_normal_irradiance`), which is the causal variable behind
generation rather than a proxy for it.

**It was validated rather than assumed.** Open-Meteo's archive irradiance was correlated
against 242 days of this plant's own measured output (2026-01-01 to 2026-08-31,
`inverter_data_daily_summary`):

| Metric | Result |
|---|---|
| Pearson r | **0.730** |
| Variance explained (r²) | **53.3%** |
| Linear fit | `kWh ≈ 7.06 × MJ/m² − 10.8` |
| Mean absolute error | **17.3 kWh** against a 132.6 kWh mean — roughly **13%** |
| Days within 15% | 165 / 242 (**68%**) |

The extremes behave correctly — the four dullest days produced 24–48 kWh, the four brightest
179–199 kWh — so the signal is real and correctly signed.

**But r² of 53% means it explains about half the variance, and a typical day is ~13% off.**
That is entirely expected: a reanalysis grid cell is roughly 10 km across and knows nothing
about local cloud, panel soiling, shading, or inverter clipping. It is not a defect in
Open-Meteo; it is the ceiling of what gridded irradiance can tell you about one roof.

> **The constraint that follows, and it is not negotiable.** Weather is **explanatory context
> only**. It may sit near a generation chart to answer "why was yesterday low". It may **never**
> appear as, next to, or feeding any comparison figure.
>
> The reconciliation hero reports variances around 4%. A weather-derived "expected output"
> carrying ~13% typical error, rendered anywhere near it, would be a number that looks like
> evidence and is not. This project has already been damaged twice by figures that looked like
> data and were not — fabricated zeros — and that is the same failure in a new costume.
>
> No "expected vs actual" panel. No weather-adjusted performance ratio. No estimated-loss
> figure. If someone later wants those, they need a modelled PV yield calibrated to this array,
> not a public irradiance grid.

**If accuracy were the bar for keeping it, it would fail.** The feature survives because the
bar for *explanation* is lower than the bar for *comparison*, and it is being held to the
lower one deliberately.

Implementation notes:

- Two endpoints: `api.open-meteo.com` (forecast) and `archive-api.open-meteo.com` (history).
  The archive lags real time by several days; the forecast endpoint covers recent past days.
- **The CSP in `vercel.json` must be extended.** `connect-src` currently allows Supabase and
  Clerk only, so a browser-side call is blocked with no visible error — the failure mode is a
  silently empty panel. Add both Open-Meteo hosts, or proxy server-side.
- Coordinates: `7.0713 N, 80.0088 E`. Open-Meteo snaps to its nearest grid point
  (`7.065, 80.042`, about 4 km away) — worth knowing, and part of why the error floor exists.
- Weather is decoration in the load-bearing sense: if the request fails, the panel disappears.
  Nothing else on the page may depend on it.

### 7.3 Hero shows the in-progress period, CEB side `null`

**Decided:** the hero shows the **current, in-progress** period — not the last finalised one.

This is the more useful default (it answers "how am I doing *now*"), and it is also the harder
state to render honestly, which is why it is specified here rather than left to implementation.

LR-001 defines three states and the hero must distinguish them visually, not just numerically:

| State | Inverter | CEB | Variance |
|---|---|---|---|
| Finalised | complete sum | from the bill | computed and shown |
| **In progress** (default) | partial sum, period start → today | **`null`** | **not computed** |
| Future | not started | `null` | not shown |

For the in-progress state:

- The inverter figure is a **partial** sum and must be labelled as such — a running total across
  an incomplete window, never presented as a period result.
- The CEB side renders as **"awaiting bill"**, or similar language. It renders as
  `null`-meaning-unavailable. **It must not render as `0`, as an em dash implying zero, or as a
  projection.**
- The variance row is **absent or explicitly suppressed**. It is not `0`, not "—", not
  "pending 0 kWh". A variance against an unknown is undefined, and rendering any number there
  invents one.
- The period header still states the real span (`5 Aug – ongoing`), per D5.

A link to the most recent finalised period sits alongside, since that is the figure with a real
variance attached.

> `null` is not `0`. It is the rule this codebase has broken twice and the one the hero is most
> exposed to, because the hero's whole job is to show a comparison during the weeks when half of
> it does not exist yet.

---

## 8. References

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design and the current data model
- [`logic-registry/LR-001`](./logic-registry) — the bill-period alignment rule D5 depends on
- [`PROJECT_AUDIT_2026-09.md`](./PROJECT_AUDIT_2026-09.md) — the UI/UX findings that predate
  this teardown
