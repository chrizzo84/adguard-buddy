
# AdGuard Buddy

AdGuard Buddy is a Next.js application for managing and synchronizing multiple [AdGuard Home](https://adguard.com/en/adguard-home/overview.html) instances. It provides a modern dashboard UI to control, monitor, and sync settings, query logs, and statistics across your AdGuard Home servers.

## Features

- **Dashboard**: View the status of all configured AdGuard Home instances, including protection status, DHCP, running state, DNS/HTTP ports, and version. Toggle protection on/off for each instance.
- **Query Log**: Inspect DNS query logs from selected AdGuard Home servers. Filter by status, search, and view details. Supports polling and manual refresh.
- **Statistics**: Display statistics such as top queried domains, blocked domains, clients, upstreams, and average processing time for each server.
- **Sync Status**: Compare and synchronize settings (filtering, querylog config, stats config) between master and replica AdGuard Home instances. Shows detailed sync logs and differences.
- **Settings**: Manage your list of AdGuard Home connections (IP, port, username, encrypted password). Set a master server for synchronization. Change the UI theme.

## System Architecture

- **Frontend**: Built with Next.js, React, and Tailwind CSS for a fast, modern UI.
- **API Routes**: All backend logic is implemented as Next.js API routes under `src/app/api/`. These handle:
	- `/api/get-connections`: Load connections from `.data/connections.json`.
	- `/api/save-connections`: Save connections and master server info.
	- `/api/adguard-control`: Toggle protection status on AdGuard Home.
	- `/api/query-log`: Fetch DNS query logs.
	- `/api/statistics`: Fetch statistics from AdGuard Home.
	- `/api/get-all-settings`: Retrieve all settings from a server for comparison/sync.
	- `/api/set-filtering-rule`: Add or remove filtering rules.
	- `/api/check-adguard`: Test connection and fetch status/statistics.
	- `/api/sync-category`: Stream sync operations for selected categories (filtering, querylog config, stats config) between master and replica.

## Pages Overview

- **Home (`/`)**: Welcome page with navigation menu.
- **Dashboard (`/dashboard`)**: Overview of all servers, their status, and quick actions.
- **Query Log (`/query-log`)**: View and filter DNS query logs for selected server.
- **Statistics (`/statistics`)**: Show statistics for the selected server.
- **Sync Status (`/sync-status`)**: Compare and synchronize settings between master and replica servers. Shows differences and sync logs.
- **Settings (`/settings`)**: Manage server connections, set master server, test connections, and change UI theme.

## Environment Variables

**Required:**

- `NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY` — Used to encrypt/decrypt AdGuard Home passwords stored in `.data/connections.json`. Set this in your environment for secure password handling. Example:

```bash
export NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY="your-strong-key"
```

If not set, defaults to `adguard-buddy-key` (not recommended for production).

## Usage

### Install dependencies

This project uses [pnpm](https://pnpm.io/) for fast, efficient package management. You can also use npm or yarn, but pnpm is recommended.

```bash
pnpm install
```

### Start development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
pnpm build
pnpm start
```

### Lint

```bash
pnpm lint
```

## Data Storage

Connection data is stored in `.data/connections.json` (created automatically). Do not commit this file to version control.

## Tech Stack

- Next.js
- React
- Tailwind CSS
- TypeScript
- CryptoJS (for password encryption)

## Contributing

Pull requests and issues are welcome!

## License

MIT
