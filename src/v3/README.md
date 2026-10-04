# src/v3: the new frontend

Lives at `/v3` until cutover (v1 `/dashboard` is untouched). Built slice by slice on `integration/v3-ui`;
spec and rules in `docs/design/v3/README.md`, plan in `docs/V3_REFACTOR_PLAN.md` (P5b), workflow in
`docs/WORKING_RULES.md` 7a.

| Folder | Purpose |
|---|---|
| `theme/` | Theme registry (`themes.js`), provider, saved preference. A theme = a block in `styles/tokens.css` + one registry entry. |
| `styles/` | `tokens.css` (the only place colours live), `base.css` (components, phone layout). |
| `access/` | Clerk -> level (`none`/`viewer`/`admin`), `RequireAccess`. Browser convenience only; the API enforces. |
| `data/` | `client.js` (live or demo source), `cache.js`, `DataProvider`, `useResource`. Unknown is `null`, never 0. |
| `shell/` | Sidebar / bottom tab bar, header, `nav.js` (navigation as data). |
| `ui/` | Primitives: `Glass`, `Segmented`, `Tip` (hover + focus + tap), `Pill`, `Note`. |
| `pages/` | One file per route. Placeholders name the slice that will replace them. |

Rules: components read tokens, never literal colours; every hint works by tap; charts get a table view; no
Supabase access from the browser; keep pure logic in `.js` files so it is unit-tested (`tests/v3*.test.js`).
