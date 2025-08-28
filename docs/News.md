# ✨ What's New in AdGuard Buddy ✨

**August 28, 2025**

## 🛠️ HTTPS / URL support & insecure SSL override

- You can now enter a full HTTP/HTTPS URL in Settings (include the scheme, e.g. https://adguard.example.com).
- The app accepts either an IP address or a full URL in a single "target" field. When you enter an HTTPS URL the port defaults to 443 (you can still override the port manually).
- New option: "Allow insecure SSL" — when enabled the server will accept self-signed certificates for that connection.

Files touched: `src/app/settings/page.tsx`, `src/app/lib/httpRequest.ts`, `src/lib/httpRequest.ts`, and several API routes.

## 🔁 Unified connection identifier

- Connection identity is normalized across the UI and server: we prefer a trimmed URL (no trailing slash) when present, otherwise we use `ip:port`. This fixes issues where the UI showed "undefined" or duplicated entries.

## 🧰 Query Log, Dashboard & Sync improvements

- Query Log: combobox and color chooser now show truncated, readable server labels and correctly fetch logs for URL-based connections.
- Dashboard: shows a truncated connection id and avoids layout overflow caused by long URLs.
- Sync view: per-replica errors are surfaced, and settings comparison uses the normalized connection id so differences are detected reliably.

Files touched (examples):
- `src/app/query-log/page.tsx` and `src/app/query-log/PageControls.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/sync-status/page.tsx`

## ✅ Lint & type hygiene

- Addressed a number of TypeScript/ESLint issues (removed unsafe `any` usage and fixed unused variables) so the project lints clean locally.

Files touched: several API routes and helpers (see git history for full list).

---

**August 25, 2025**

## 🛠️ News Popup: Single Close Button (×)

- The in-app "What's New" popup was simplified: the footer "Got it!" button was removed and replaced with a single close button (×) in the top-right for clearer interaction and better contrast in both themes.

**August 24, 2025**

## 🧭 Query Log: Combined View, Server IDs & Color Highlighting

New improvements to the Query Log make multi-server troubleshooting much easier:

- Single / Combined view: choose between a single-server view or a combined view that aggregates logs from all configured servers.
- Server ID in the table: each log row now displays the source server (URL or IP) so you can quickly see which server emitted the request.
- Persistence: selected colors are saved into the connections JSON file (`.data/connections.json`) so they survive reloads.
- Per-server Color Chooser: click the color swatch next to a server and pick a color — rows from that server are subtly highlighted in the table.
![Color Chooser](/api/news-img?name=color_combined.png)

## ⚡ Performance & UX

- Batched fetching & concurrency controls: combined fetches are executed in configurable batches with limited parallelism so the client stays responsive.
- Stable controls: the controls bar (view mode, server select, refresh interval) was refactored and memoized so polling only updates the table — dropdowns keep their selection and focus.

## 🧩 Technical details & files

- See `src/app/query-log/page.tsx` (log UI, swatches, persistence) and `src/app/query-log/PageControls.tsx` (memoized controls) for the main changes.

---

**August 23, 2025**

## 📊 Combined Statistics

- New: view combined statistics from all AdGuard Home instances in one place. This aggregates queries, blocked counts, top domains, and more.

## 🚀 "What's New" Popup

- A lightweight Markdown-powered popup was added to keep you informed about releases and improvements directly inside the app.

---

If you'd like, I can:
- Consolidate the duplicate `httpRequest` helper into a single module and update imports.
- Create a short release note for the app README.
- Run a dev build and smoke-test the HTTPS + self-signed cert flow if you have an AdGuard instance to test against.