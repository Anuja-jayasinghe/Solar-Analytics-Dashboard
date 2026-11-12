# LR-004: CEB vs Inverter Earnings Difference

Status: Implemented in `shared/domain/earningsDifference.js`; shown per bill month under CEB vs Inverter (see "How it is shown")
Owner: Dashboard data pipeline
Primary files:
- shared/domain/earningsDifference.js
- tests/earningsDifference.test.js
Replaces: the v1 "Potential vs. Actual Earnings" tile (`EarningsDifference.jsx`)

## Purpose
Answer one question in rupees: **how much did CEB pay us compared with what the inverter's generation was worth at that bill's own rate?**

**Sign convention: difference = CEB paid − inverter value.** Negative means CEB paid *less* than the inverter generated (we received less than the generation was worth); positive means CEB paid more.

The gap is energy the inverter generated that CEB did not credit (self-consumption, line loss, meter differences, a day the meter missed). It is a difference between two measured things at the rate CEB actually paid; not a forecast and not a verdict.

## Why v1 was wrong (and what this replaces)
v1 computed `all-time inverter kWh × today's tariff − sum of all bills`. That is not like-for-like:

1. The inverter total includes generation before the first bill and the current unbilled period.
2. Today's tariff is applied to years that were billed at other rates.
3. Its "possible accounting error" warning was a symptom of 1 and 2, not a finding.

## Data sources
- Per bill period from LR-001: `inverterKwh`, `daysPresent`, `daysInPeriod`, `cebKwh` (`units_exported`).
- `ceb_data.earnings` (LKR actually paid on that bill).
- The Settings tariff is **not** used by this logic.

## Canonical rules

1. **Per bill period `p`** (the same window LR-001 builds: previous bill date + 1 day … bill date):
   - `rate_p = earnings_p ÷ cebKwh_p` (the effective rate; same value as `buildBillRatePeriods`)
   - `inverterValue_p = inverterKwh_p × rate_p`
   - `difference_p = earnings_p − inverterValue_p = (cebKwh_p − inverterKwh_p) × rate_p`
   - Negative means CEB paid less than the inverter generated; positive means CEB paid more.
2. **Eligibility.** A period counts only when ALL hold:
   - the bill exists and is finalized (LR-001 status `finalized`),
   - `cebKwh > 0` and `earnings` is a finite number (so a rate exists),
   - every day of the period has inverter data (`daysPresent === daysInPeriod`, `> 0`).
   Otherwise the period is **excluded and counted**, with its reason. A period is never given a
   difference of 0 because it is ineligible.
3. **Lifetime / range total** = sum of `difference_p` over eligible periods only. The result also
   states `includedPeriods`, `excludedPeriods` (with reasons) and the covered date span, so the UI
   can say "over 19 of 20 bills".
4. **The current, unbilled period is never included.** It has no `earnings`.
5. **Percent difference** = `difference ÷ inverterValue` over the same eligible periods; `null` if the
   eligible inverter value is 0 or there are no eligible periods.
6. **No eligible period ⇒ every figure is `null`**, never 0.
7. **No accounting-error warning for either sign.** A positive value (CEB paid more than the inverter recorded) is a neutral meter or data-completeness note, never an error banner.
8. Every figure is labelled with its basis ("each bill's own rate"), never with today's tariff.

## Worked example
Two finalized, complete bills:

| Bill | Inverter kWh | CEB kWh | Earnings (LKR) | Rate |
|---|---|---|---|---|
| A | 1,500 | 1,400 | 56,000 | 40.00 |
| B | 1,600 | 1,590 | 63,600 | 40.00 |

- A: `(1400 − 1500) × 40 = −4,000`; B: `(1590 − 1600) × 40 = −400`.
- Total difference **−4,400 LKR** over 2 bills (CEB paid 119,600 vs inverter value 124,000); percent −3.55% (difference ÷ inverter value).
- Add a third bill with 29 of 31 days recorded: excluded (`incomplete_days`), total unchanged.

## Edge cases
- `cebKwh = 0` or `earnings` missing: excluded (`no_rate`).
- Inverter total missing for the period: excluded (`no_inverter_data`).
- Bill present but not finalized: excluded (`not_finalized`).
- Rates differ across bills: each period uses its own; they are never averaged.

## Acceptance criteria
Executable in `tests/earningsDifference.test.js`: worked example, each exclusion reason, null (not 0)
when nothing is eligible, the sign convention (CEB paid less = negative), no warning flag, the current unbilled
period excluded, and the Settings tariff having no effect.

## How it is shown (2026-11-12, issue #226)
One row of cells under the **CEB vs Inverter** chart, one per bill month and lined up with its columns. Each answers
one question at a glance: **did CEB pay for what the inverter made?**

| Cell | When | Looks |
|---|---|---|
| `✓ even` | the month's kWh difference is within `GAP_MATCH_PCT` (1%) of the inverter | neutral |
| `▼ 4.0 K` | CEB paid less than the generation was worth, in LKR | amber tint |
| `▲ 1.2 K` | CEB paid more | green tint |
| `–` | not comparable (missing days, no rate): never an amount, never 0 | blank |
| (blank) | the open period, bill not issued yet | blank |

- Above the row, one sentence for the months in view: "9 of 12 bills compared: 7 even · 2 paid less (LKR 9.6 K short)".
- The tooltip and screen readers carry the period and the words: "CEB paid LKR 4.0 K less than the generation was
  worth (9.1%)".
- Within 1% counts as even because separate meters and meter-reading days make small differences normal.
- The all-time total, the signed headline and the paid/worth chips were removed: they made the reader translate a minus
  sign and compare several totals.
- Code: `gapCell`, `gapCounts` and `gapSentence` in `src/v3/ceb/rows.js`, and `src/v3/ceb/GapStrip.jsx`. Tests:
  `tests/v3CebRows.test.js`.

## Current implementation files
- [shared/domain/earningsDifference.js](../../shared/domain/earningsDifference.js)
- [tests/earningsDifference.test.js](../../tests/earningsDifference.test.js)
- [src/v3/ceb/rows.js](../../src/v3/ceb/rows.js) (`gapCell`, `gapCounts`, `gapSentence`) and [src/v3/ceb/GapStrip.jsx](../../src/v3/ceb/GapStrip.jsx)
