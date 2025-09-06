<p align="center">
	<img src="src/app/icon.svg" alt="AdGuard Buddy Logo" width="120" />
</p>

# AdGuard Buddy


> A modern dashboard & API interface for AdGuard Home – simple, fast, and clear.

---

## 🎯 Goal

**AdGuard Buddy** is designed to keep multiple AdGuard Home instances synchronized, allowing you to monitor statistics, logs, and settings of all your AdGuard servers in one place. 

One server acts as the master, and its settings can be synchronized to the other servers. The Sync view clearly shows when servers are not in sync with the master, so you always know the current status. Easily view, manage, and control several AdGuard installations from a single point – perfect for users with multiple AdGuard instances.

---

---

## 🚀 Features

- Clean Next.js dashboard for AdGuard Home
- API interface for AdGuard Home functions
- Log and statistics visualization
- Manage filtering rules and connections
- Category synchronization
- Dark/Light mode
- Docker support

---

## 🛠️ Installation

### Local

```bash
pnpm install
pnpm dev
```

### Pre-Build Image:

You can find it here:
https://github.com/chrizzo84/adguard-buddy/pkgs/container/adguard-buddy

### Docker

```bash
docker build -t adguard-buddy .
docker run -p 3000:3000 adguard-buddy
```

---

## 🧪 Development & Testing

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build           # Build for production
pnpm start           # Start production server

# Testing
pnpm test            # Run tests
pnpm test:watch      # Run tests in watch mode
pnpm test:coverage   # Run tests with coverage report
pnpm test:ci         # Run tests for CI (no watch)

# Code Quality
pnpm lint            # Run ESLint
pnpm lint:fix        # Run ESLint with auto-fix
pnpm type-check      # Run TypeScript type checking

# Combined
pnpm ci              # Run lint + type-check + test:ci
pnpm pre-commit      # Run lint + test (for pre-commit hooks)
```

### Testing Overview

- **Framework:** Jest with React Testing Library
- **Coverage:** 76.45% overall (75%+ target achieved)
- **Test Suites:** 29 test suites with 300 total tests
- **CI/CD:** Automated testing on every push/PR

### Coverage Breakdown

| Component | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|-------|
| Components | 100% | 92.85% | 100% | 100% |
| Library | 100% | 100% | 100% | 100% |
| API Routes | 85.71% | 100% | 69.89% | 83.33% |
| Dashboard | 56.12% | 70.58% | 61.11% | 57.29% |
| Settings | 63.57% | 48.33% | 57.14% | 65.94% |
| Query Log | 54.26% | 52.5% | 53.16% | 56.5% |

### CI/CD Pipeline

The project uses GitHub Actions for automated testing and quality assurance:

- **Build & Test:** Runs on every push and PR
- **Linting:** ESLint with zero warnings allowed
- **Type Checking:** Full TypeScript compilation check
- **Coverage:** Automated coverage reporting with Codecov
- **Security:** Dependency vulnerability scanning
- **Performance:** Lighthouse performance monitoring
- **Docker:** Automated container builds and publishing

### Workflow Files

- `.github/workflows/build-only.yml` - Main CI pipeline
- `.github/workflows/security.yml` - Security and dependency checks
- `.github/workflows/quality.yml` - Code quality monitoring
- `.github/workflows/performance.yml` - Performance and Lighthouse
- `.github/workflows/docker-publish.yml` - Docker publishing
## ⚙️ Environment Variables

**Required:**

- `NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY` — Used to encrypt/decrypt AdGuard Home passwords stored in `.data/connections.json`. Set this in your environment for secure password handling. Example:

```bash
export NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY="your-strong-key"
```

If not set, defaults to `adguard-buddy-key` (not recommended for production).

---

## 📋 API Endpoints

The main API routes are located in `src/app/api/`:

- `/api/adguard-control` – Control AdGuard Home
- `/api/query-log` – Query logs
- `/api/statistics` – Fetch statistics
- `/api/set-filtering-rule` – Set filtering rules
- `/api/get-connections` – Show connections
- ...and more

---

## 🖼️ Screenshots

![Dashboard](pics/dashboard.png)
---
---
![Query Log](pics/querylog.png)
---
---
![Statistics](pics/stats.png)
![alt text](pics/combined_stats.png)
---
---
![Sync Status](pics/sync.png)
---
---
![Settings](pics/settings.png)

---

## 🤝 Contributors

- [chrizzo84](https://github.com/chrizzo84) – Maintainer

---

## 📄 License

MIT

