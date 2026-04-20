# Inverter Health Panel Spec

## Purpose
The Inverter Health panel is a technical operations view for the Solar Analytics Dashboard. It is meant to answer three questions quickly:

1. Is the inverter currently healthy?
2. When did it produce power today and over the last several days?
3. What alarms or faults are active, repeating, or already resolved?

The panel is not a marketing view and not a generic dashboard card. It is a troubleshooting surface for operators who need live status, recent history, and evidence-backed diagnostics in one place.

## Where It Lives
- Main implementation: [src/components/SolisExplorer.jsx](../src/components/SolisExplorer.jsx)
- Shared date formatting used by the panel and related UI: [src/lib/dateFormatter.js](../src/lib/dateFormatter.js)

## What The Panel Should Show

### 1. Top Metrics
The header metric row should summarize the current inverter state in a compact way:
- Health score
- Realtime power
- Today energy
- Unresolved alarms
- Average uptime for the last 7 days

These metrics are meant to be visible immediately without scrolling.

### 2. Uptime Graph
The uptime section should show a 7-day operational view of the inverter.

It should display, for each day:
- Date
- Uptime percentage
- Observed active window
- Sample count used for the calculation
- State classification: on, intermittent, mostly-off, or off

This is the main graph-like diagnostic view. It should be rendered as a single card, not split across multiple cards.

### 3. Alarm Intelligence
The alarm section should show:
- A chronological alarm timeline
- A grouped alarm ledger
- Expanded alarm details on click

The timeline is for event order. The ledger is for repeated patterns and counts.

### 4. Inverter Identity
The panel should show the inverter identity fields returned by the API when available:
- Inverter ID
- Serial number
- State
- Last diagnostics update
- Data points for the current day

## How It Works

### Data Flow
The panel uses the real Solis explorer API through the application backend route:
- `/api/solis/explore`

The panel requests these endpoint keys:
- `inverterList`
- `inverterDetail`
- `inverterDay`
- `alarmList`

### Load Sequence
1. Fetch the inverter list.
2. Pick the first available inverter.
3. Use that inverter’s `sn` or `id` for follow-up calls.
4. Fetch live detail and today’s day-series data.
5. Fetch alarms for the same station.
6. Fetch last 7 days of `inverterDay` data for uptime history.

### Uptime Calculation
The uptime graph is not guessed. It is derived from the `inverterDay` samples returned by Solis.

For each day:
- Read the sample timestamps.
- Normalize numeric-string timestamps such as `1776645134124`.
- Sort samples by time.
- Estimate the expected sample interval using the median gap between points.
- Compute coverage as actual sample count divided by expected sample count.
- Classify the day from that coverage:
  - `on` for high coverage
  - `intermittent` for moderate coverage
  - `mostly-off` for low coverage
  - `off` when no samples exist

The visible uptime bar is a coverage indicator based on telemetry continuity, not an electrical model.

### Alarm Display Logic
The panel uses two alarm representations:

#### Alarm Timeline
Chronological event list, sorted newest first.

#### Alarm Ledger
Grouped summary keyed by alarm code and alarm message.
It shows:
- code
- name/message
- level
- total occurrences
- open occurrences
- last seen timestamp

When a row is expanded, the panel shows only fields that are actually present in the API response:
- alarm message
- advice
- state
- device serial
- machine/model
- station name
- start time
- end time
- duration

The panel must not invent alarm descriptions if the API does not provide them.

## Verified API Evidence
This design is based on live endpoint checks performed on April 20, 2026.

### Endpoint Discovery
The explorer endpoint registry confirms that the alarm endpoint is read-only and supports these parameters:
- `pageNo`
- `pageSize`
- `stationId`
- `alarmDeviceSn`
- `alarmBeginTime`
- `alarmEndTime`
- `state`
- `nmiCode`

### Alarm Payload Fields Observed
The live `alarmList` response included fields such as:
- `alarmCode`
- `alarmMsg`
- `alarmLevel`
- `state`
- `alarmBeginTime`
- `alarmEndTime`
- `alarmLong`
- `advice`
- `stationName`
- `alarmDeviceSn`
- `machine`
- `model`

This means the alarm panel can show real technical details, but it cannot truthfully provide a code glossary unless an official mapping source is added later.

### Uptime Feasibility Evidence
The live `inverterDay` payload contains timestamped telemetry samples for the selected inverter.

Observed fields included:
- `dataTimestamp`
- `timeStr`
- `time`
- `pac`
- `state`

The `dataTimestamp` value is returned as a numeric string, so the panel must normalize it before calculating uptime.

The live probes confirmed that recent days return dense sample series, which is enough to calculate daily uptime coverage and on-window periods.

## Empty-State Rules
The panel should not look broken when some data is unavailable.

Expected empty behaviors:
- If uptime data is unavailable, show a clear message instead of hiding the card.
- If there are no alarms, show an explicit “no active alarms” message.
- If no inverter is returned, show a clear retry state.
- During initial load, show skeleton placeholders instead of collapsing the panel.

## Date Format Rules
Dates shown in the panel and related operational views should use DD/MM/YYYY formatting.

This applies to:
- uptime rows
- alarm dates
- user-facing timestamps where a date-only format is appropriate

## What This Panel Is Not
This panel is not:
- a guess-based alarm dictionary
- a synthetic uptime demo
- a mock data visualizer
- a generic chart widget

It is a real-data diagnostic view built from the Solis APIs that are currently reachable in the workspace.

## Current Constraint
The panel can only describe alarm meaning at the level of the fields Solis returns.

If a future official code-to-description reference becomes available, the panel can be extended to show a richer alarm dictionary. Until then, it should display verified API data only.
