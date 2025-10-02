# ✨ What's New in AdGuard Buddy ✨

**October 2, 2025 - v0.1.20251002**

## 🔧 CRITICAL FIX: Connection & Sync Issues After Container Upgrade

**Important bug fixes!** This release resolves critical issues that occurred after container upgrades.

### 🐛 Issues Fixed:

**1. Master Server State Broken** ⭐
- Fixed master server star icon not highlighting correctly
- Resolved "lost" master server after container upgrade
- Connection identification now consistent across all pages
- **Impact**: Master server is now correctly identified and displayed

**2. Connection Validation Problems** 🔌
- Fixed existing connections not working after upgrade
- Eliminated need to manually remove/re-add connections
- Automatic migration of old connection data format
- **Impact**: All existing connections work immediately after upgrade

**3. Auto-Sync Master Server Lookup** 🔄
- Fixed "Master server connection not found" error in auto-sync
- Connection ID now includes port number for accurate matching
- Improved error logging for better troubleshooting
- **Impact**: Auto-sync now finds master server reliably

### 🔧 Technical Details:

**Connection ID Normalization:**
- Implemented consistent `getConnectionId()` helper across all components
- Format: `ip:port` (e.g., `192.168.1.1:80`) or `url` (e.g., `http://adguard.local`)
- Applied uniformly in: Settings page, Sync Status page, Auto-Sync scheduler, API routes

**Automatic Data Migration:**
- `get-connections` API now auto-migrates old master server IDs
- Detects legacy formats and converts to normalized format
- Changes saved automatically on first load
- Detailed logging for migration troubleshooting

**Better Error Messages:**
- Auto-sync now shows exactly what master server it's looking for
- Lists all available connections when match fails
- Makes debugging connection issues much easier

### 📝 Files Modified:
- `src/app/settings/page.tsx` - Master server selection logic
- `src/app/sync-status/page.tsx` - Connection lookup consistency
- `src/app/api/get-connections/route.ts` - Auto-migration functionality
- `src/app/lib/auto-sync-scheduler.ts` - Fixed connection matching
- Tests updated to match new normalized format

### 🎯 What This Means For You:
✅ Upgrade containers without connection issues  
✅ Master server always correctly identified  
✅ Auto-sync works reliably after upgrades  
✅ No manual intervention needed - automatic migration  
✅ Better error messages for troubleshooting  

---

**October 1, 2025 - v0.1.20251001**

## 🔄 AUTO-SYNC: Automatic Server Synchronization

> ⚠️ **BETA Feature** - This is a new feature currently in beta testing. Please report any issues you encounter.

**Major new feature!** AdGuard Buddy now supports **automatic synchronization** of your master server settings to all replica servers.

### What's New:

**⚙️ Configurable Auto-Sync (Settings Page)**
- ✅ Enable/disable automatic synchronization with a single toggle
- ✅ Choose sync interval: 5 minutes to 24 hours (9 preset options)
- ✅ Select which categories to auto-sync (6 available categories)
- ✅ Real-time status: Last sync time and next sync countdown
- ✅ Auto-refreshing status display

**⏸️ Pause/Resume Controls**
- ✅ **Pause** auto-sync temporarily without losing configuration
- ✅ **Resume** auto-sync with one click when maintenance is complete
- ✅ Perfect for maintenance windows and troubleshooting
- ✅ Paused state persists across app restarts
- ✅ Visual indicators show paused state in Settings and Sync Status pages

**🚀 Manual Trigger**
- ✅ **"Trigger Now"** button for immediate sync execution
- ✅ Test auto-sync configuration without waiting for next interval
- ✅ Available in Auto-Sync History tab
- ✅ Shows results immediately in sync logs

**📊 Auto-Sync History Dashboard (Sync Status Page)**
- ✅ New tabbed interface: "Manual Sync Status" + "Auto-Sync History"
- ✅ Comprehensive status dashboard with metrics:
  - Active/Paused/Inactive status indicator
  - Success rate percentage
  - Success and failure counts
  - Active categories display
- ✅ Historical sync logs with detailed information:
  - Timestamp and duration for each sync
  - Success/error status with color coding
  - Detailed error messages for troubleshooting
- ✅ Advanced filtering:
  - Filter by replica server
  - Filter by category
  - Filter by success/error status
- ✅ Auto-refresh every 10 seconds
- ✅ Up to 500 recent sync operations retained

**� Smart Conflict Prevention**
- Manual sync is automatically disabled when auto-sync is active
- Clear warning banners explain the current state
- Blue info banner when auto-sync is paused
- Yellow warning banner when auto-sync is active
- Manual sync re-enabled automatically when auto-sync is paused or disabled

**�🛡️ Robust Error Handling**
- Graceful handling of missing connections
- Warning logs instead of crashes
- Continues operation even if replicas are temporarily unavailable
- Automatic password decryption for authentication

### Categories You Can Auto-Sync:
1. **Filtering** - Blocklists, whitelists, and custom rules
2. **Query Log Config** - Query logging settings
3. **Statistics Config** - Statistics collection settings
4. **DNS Rewrites** - Custom DNS rewrite rules
5. **Blocked Services** - Service blocking configuration
6. **Access Lists** - Client access control

### Get Started:
1. Navigate to **Settings** → Enable "Automatic Sync"
2. Choose your sync interval (we recommend "Every 15 minutes")
3. Select categories to sync (start with "Filtering")
4. Monitor progress in **Sync Status** → "Auto-Sync History" tab
5. Use "Pause" button for maintenance, "Resume" when ready
6. Use "Trigger Now" button in Auto-Sync History for immediate testing

### Key Features Implemented:
- ⚙️ Configurable scheduler with cron-like intervals
- 💾 Persistent configuration and logs (survives restarts)
- � Comprehensive logging with timestamps and durations
- 🔄 Separate sync logic for both manual and automatic operations
- ⏸️ Pause/Resume controls without losing configuration
- 🚀 Manual trigger for immediate sync execution
- 🔒 Conflict prevention between auto and manual sync
- 🎨 Visual status indicators and informative banners

Files added/modified: `src/app/lib/auto-sync-scheduler.ts`, `src/app/api/auto-sync-config/route.ts`, `src/app/api/auto-sync-pause/route.ts`, `src/app/api/auto-sync-trigger/route.ts`, `src/app/api/sync-category/sync-logic.ts`, `src/app/settings/page.tsx`, `src/app/sync-status/page.tsx`, `src/types/auto-sync.d.ts`

---

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