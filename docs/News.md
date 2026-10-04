# ✨ What's New in AdGuard Buddy ✨

**October 4, 2026 - Persistent client sync**

## 👥 Persistent clients are now synced

- **New sync category** - "Persistent clients" copies the named devices from *Settings → Client settings* to your replicas, together with their own filtering, parental control, SafeSearch, blocked services and schedules, upstreams and tags.
- **Full mirror** - Missing clients are added, changed ones are replaced and clients that only exist on a replica are removed, so a device keeps its rules whichever server it asks.
- **Drift view** - Sync status lists each missing, extra or changed client and the exact fields that differ.
- **Mixed versions** - Fields only one AdGuard Home version knows about are ignored instead of showing up as permanent drift.
- **Opt-in for auto-sync** - Enable it under *Settings → Automatic sync*. It is off by default because it deletes clients on replicas that the master does not have.
- **Runtime clients stay local** - Clients discovered via ARP, DHCP or rDNS are not synced; AdGuard Home rebuilds them on every server.

---

# ✨ What's New in AdGuard Buddy ✨

**September 2, 2026 - Redesign & credential hardening**

## 🔐 Credentials never reach the browser

**This is a breaking configuration change - please read.**

- **Server-side only** - Passwords are decrypted inside API routes. Pages now address a server by its connection id and never send credentials over the wire.
- **New key variable** - Use `ADGUARD_BUDDY_ENCRYPTION_KEY`. The old `NEXT_PUBLIC_` name shipped the key inside the browser bundle, so treat any key stored under it as public and rotate your AdGuard Home passwords.
- **Stronger encryption** - New passwords use AES-256-GCM with a scrypt-derived key. Existing entries are re-encrypted automatically on first read.
- **Optional login** - Set `ADGUARD_BUDDY_AUTH_USER` and `ADGUARD_BUDDY_AUTH_PASSWORD` to require HTTP Basic auth for the whole app.
- **Debug endpoint removed** - `/api/test-decrypt` exposed connection ids, usernames and key hints without authentication. It is gone.

## 🎨 Redesigned interface

- **Sidebar navigation** - Replaces the top bar and its duplicated mobile row.
- **One global server scope** - Pick Single or All once in the header; every page follows it.
- **Fleet dashboard** - Aggregate KPIs plus a compact server table with status, protection toggle and a 24h sparkline, so ten servers fit on one screen.
- **Real charts** - Queries per hour now has a value axis, gridlines, a hover readout and time labels derived from the data. When a server reports no history you get an empty state instead of invented numbers.
- **Consistent status language** - One badge component everywhere; no more mixed pills and emoji.
- **Accessibility** - Labelled inputs, dialogs with Escape and focus trapping, and skeletons that match the final layout.

## 🐛 Fixes

- **Combined statistics** - A typo in the encryption key variable made combined stats fall back to the default key, so anyone with a custom key got 401s.
- **Server colours** - Colours were matched on the bare IP and silently never saved for URL or `ip:port` servers.
- **Block/unblock** - Now asks for confirmation and states plainly that the rule is written to every configured server; failures are reported instead of ignored.
- **Request timeouts** - Outgoing calls have a 15s timeout, so an unreachable server no longer hangs a page.
- **Auto-sync keys** - The scheduler no longer tries a list of keys including the built-in default, which quietly defeated a custom key.

## 📦 Packaging

- **Smaller image** - Multi-stage build on Next's standalone output, running as a non-root user.
- **Persistent config** - `/app/.data` and `/app/logs` are declared volumes; mount them or your connections are lost when the container is recreated.

---

# ✨ What's New in AdGuard Buddy ✨

**January 8, 2026 - v0.1.20260108**

## 📊 Statistics Improvements

**Real-time hourly data and expandable threat details!**

### 📈 Real Hourly Statistics:
- **Authentic Data** - "Queries per Hour" chart now uses real `dns_queries[]` array from AdGuard API instead of simulated data
- **Accurate Blocking Stats** - Combined mode now correctly aggregates `num_blocked_filtering`, `num_replaced_safebrowsing`, and `num_replaced_parental` across all servers
- **7-Day History** - Full 168-hour data from AdGuard (last 7 days in hourly resolution)

### 🛡️ Expandable Threats Card:
- **On-Demand Loading** - Click "Show domains" to fetch threat details only when needed
- **Loading Indicator** - Spinner shows while fetching threat domains
- **Domain Details** - See actual blocked domains with type badges:
  - 🟠 **Safebrowsing** - Malware/Phishing threats
  - 🟣 **Parental** - Parental control blocks
- **Threat Breakdown** - Summary shows Safebrowsing vs Parental counts
- **Collapsible** - Click "Hide domains" to close the detail view

### ⚡ Performance:
- **Parallel API Calls** - Threat domain fetching uses `Promise.all` for faster loading
- **Optimized Limits** - Reduced query limits for snappier response times

### 📋 Files Modified:
- `src/app/api/statistics/combined/route.ts` - Added hourly array aggregation and blocking counts
- `src/app/statistics/page.tsx` - Real hourly data + expandable threats UI

---

**December 31, 2025 - v0.1.20251231**

## 🎨 COMPLETE REDESIGN

**A brand new look for Sync Status!** We have completely rebuilt the Sync Status interface from the ground up to provide a modern, card-based comparison experience. Say goodbye to raw JSON data and confusing tables.

### 💎 UI Overhaul & UX Improvements:

![Dashboard](/pics/redesign.png)

**Smart Comparison Cards** 🃏
- **Total Redesign** - Replaced the technical debug view with beautiful, user-friendly Comparison Cards.
- **Diff-Only Focus** - The intuitive new design hides identical settings and critically focuses **only** on what differs between your Master and Replica servers.
- **Visual Diff Badges** - Instantly identify the type of discrepancy with new high-contrast badges:
    - 🔵 `SETTING` - Configuration mismatches
    - 🟡 `MISSING` - Content missing on target
    - 🔴 `EXTRA` - Content present on target but not master
    - 🟠 `CHANGED` - State differences (e.g., rule counts)

**Enhanced Feedback System** 📢
- **Live Activity Hub** - The log viewer has been upgraded to a real-time status hub.
- **Smart Progress Indicators** - Animated spinners and status pulses show you exactly what the system is doing.
- **Contextual Info Banners** - Helpful explanations appear during long-running processes (like filter downloads).

### 🧠 Intelligent Sync Engine:

**Smart Filter Refresh** 🔄
- **Dual-Side Updates** - Syncing filters now automatically triggers rule updates on **both** Master and Replica servers.
- **Consistency Guarantee** - This prevents "fake" diffs caused by stale caches effectively keeping your entire fleet in perfect sync.
- **Deep Comparison** - We now detect differences in rule counts, enabled status, and list presence with precision.

### 📋 Files Modified:
- `src/app/sync-status/page.tsx` - **REWRITE:** Complete UI implementation
- `src/app/api/sync-category/sync-logic.ts` - **UPDATE:** Added smart refresh logic
- `src/app/api/refresh-filters/route.ts` - **NEW:** Refresh endpoint

---

**October 21, 2025 - v0.1.20251021**

## 🎉 NEW FEATURE: Complete DNS Settings Synchronization

**Major feature release!** Full DNS settings sync from master to client AdGuard Home instances is now available.

### ✨ Features:

**Complete DNS Settings Sync** ✅
- **Upstream DNS servers** - Sync custom upstream DNS servers (tls://, https://, regular)
- **Fallback DNS servers** - Sync DNS servers used when upstreams fail
- **Bootstrap DNS servers** - Sync bootstrap DNS for secure DNS queries
- **Load balancing mode** - Sync upstream mode (fastest_addr, load_balance, parallel)
- **DNS Cache** - Sync cache size, TTL min/max, and cache settings
- **DNSSEC** - Sync DNSSEC enable/disable flag
- **Blocking Mode** - Sync response mode (default, refused, nxdomain, null_ip, custom_ip)
- **Rate Limiting** - Sync rate limits and subnet masks
- **EDNS Client Subnet** - Sync EDNS CS settings
- **IPv6 Settings** - Sync disable IPv6 flag
- **PTR Resolvers** - Sync local PTR upstream servers
- **Advanced Settings** - Sync all other DNS configuration options

### 🔍 Smart Sync Detection:

- **Automatic Difference Detection** - Fetches both master and replica settings to identify actual differences
- **Detailed Logging** - Shows exactly which DNS settings differ during sync
- **Skips Unchanged Settings** - If DNS settings match, no sync is performed
- **Status Page Updates** - Sync Status page now correctly shows "Out of Sync" when DNS settings differ
- **Ignores Read-Only Fields** - `default_local_ptr_upstreams` and other read-only fields are properly ignored

### 📋 Files Modified:
- `src/types/auto-sync.d.ts` - Added 'dnsSettings' to SyncCategory
- `src/app/api/sync-category/sync-logic.ts` - Complete DNS settings sync implementation with difference detection
- `src/app/api/get-all-settings/route.ts` - Updated to return DNS settings under 'dnsSettings' key
- `src/app/settings/page.tsx` - Added "DNS Settings" to sync category options
- `src/app/sync-status/page.tsx` - Added DNS Settings to syncable keys and comparison ignore list
- `src/app/api/sync-category/__tests__/route.test.ts` - Added comprehensive DNS sync tests

### 🧪 Testing:

- ✅ All 378 tests pass
- ✅ 2 new DNS sync tests covering sync detection and in-sync scenarios
- ✅ Sync status page tests updated and passing

---

**October 8, 2025 - v0.1.20251008**

## 🔧 CRITICAL FIX: Custom Filter Rules Overwriting

**Important bug fix!** This release resolves a critical issue where using the unblock/block function in the query log would overwrite all existing custom filter rules.

### 🐛 Issue Fixed:

**Custom Filter Rules Being Overwritten** ⚠️
- Fixed query log unblock/block function deleting all existing custom rules
- Rules are now properly preserved when adding new block/unblock rules
- Manual sync and auto-sync continue to work correctly
- **Impact**: All custom filter rules are now safe when using quick block/unblock actions

### 🎯 Root Cause:

The AdGuard Home API endpoint `/control/filtering/set_rules` **replaces** the entire custom rules list rather than appending to it. The previous implementation was sending only the new rule, which caused all existing rules to be deleted.

### ✨ Solution Implemented:

**Three-Step Process:**
1. **Fetch existing rules** - Retrieves current custom rules from the server before making changes
2. **Intelligent merge** - Combines new rule with existing rules:
   - Prevents duplicate rules
   - Removes conflicting rules (e.g., removes block rule when adding unblock for same domain)
   - Preserves all other existing rules, including comments
3. **Update complete list** - Sends back the full set of rules to AdGuard Home

### 📋 Features:

- ✅ **No Data Loss** - All existing custom rules are preserved
- ✅ **Smart Conflict Resolution** - Block and unblock rules for the same domain don't coexist
- ✅ **Duplicate Prevention** - Won't add the same rule twice
- ✅ **Sync-Safe** - Manual and auto-sync continue to work correctly
- ✅ **Better Feedback** - Shows detailed progress during rule updates

### 📝 Files Modified:
- `src/app/api/set-filtering-rule/route.ts` - Complete rewrite of rule management logic
- `docs/Custom-Filter-Rules.md` - New documentation explaining the implementation

---

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