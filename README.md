<p align="center">
  <img src="resources/systemscope_icon.svg" width="128" height="128" alt="SystemScope Icon" />
</p>

<h1 align="center">SystemScope</h1>

<p align="center">
  An all-in-one system monitoring and cleanup tool for developers.<br/>
  Monitor CPU, memory, GPU, and disk in real time, then move into disk analysis, Docker cleanup, and process management from one app.
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License" />
  <img src="https://img.shields.io/badge/electron-41-blueviolet" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React" />
  <a href="https://github.com/sejoung/SystemScope/actions/workflows/ci.yml">
    <img src="https://github.com/sejoung/SystemScope/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/v/release/sejoung/SystemScope" alt="Latest Release" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/release-date/sejoung/SystemScope" alt="Release Date" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/downloads/sejoung/SystemScope/total" alt="Downloads" />
  </a>
</p>

<!-- Uncomment when screenshots are ready
<p align="center">
  <img src="docs/screenshots/dashboard.png" width="800" alt="Dashboard Screenshot" />
</p>
-->

## Highlights

- **Real-time monitoring**: CPU, memory, GPU, and disk metrics with live charts
- **Alerts**: configurable disk / memory / GPU usage alerts
- **Disk analysis**: folder scan, treemap, large files, extension breakdown, duplicate detection
- **Quick cleanup**: scan common cache, log, build, and temp locations
- **Docker management**: inspect and clean up containers, images, volumes, and build cache
- **Process tools**: search, inspect, and terminate processes
- **Port tools**: inspect active ports and monitor specific ports/IPs
- **Application cleanup**: uninstall installed apps and review leftover app data
- **Growth tracking**: snapshot-based folder growth analysis over 1 hour / 24 hours / 7 days
- **Tray resident UX**: restore the app from the menu bar or system tray
- **Dark / light themes**

For more detailed behavior, see [docs/features.md](docs/features.md).

## Pages

| Page | Description |
|------|------|
| **Overview** | Live gauges, charts, alerts, storage summary, top consumers |
| **Storage** | Folder scan, treemap, file insights, quick cleanup, file deletion |
| **Docker** | Containers / images / volumes / build cache management |
| **Activity** | Processes, ports, and live port watch |
| **Applications** | Installed apps and leftover app data cleanup |
| **Preferences** | Theme, alert thresholds, snapshot interval, app data/log paths |

## Getting Started

### Requirements

- Node.js
- npm
- macOS or Windows

Recommended:

- Node.js 20+
- `docker` CLI plus Docker Desktop or Docker Engine for Docker features
- A standard Windows environment with `reg.exe` available for Windows app management
- `.nvmrc` is included and pins the project to Node 20

### Install and Run

```bash
# install dependencies
npm install

# development mode
npm run dev

# production build
npm run build

# preview built app
npm run preview
```

### External Dependencies and Graceful Failure

Some features depend on OS tools or external commands.

- Docker pages require the `docker` CLI and a running Docker daemon.
- Disk size measurement prefers `du` on macOS/Linux and falls back to recursive scanning if unavailable.
- APFS disk correction on macOS prefers `diskutil` and falls back to standard filesystem information.
- Windows app discovery uses `reg query`.

Where possible, SystemScope degrades gracefully instead of failing hard when these commands are unavailable.

### Packaging

```bash
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows .exe
```

## Testing

```bash
npm test            # unit/integration tests
npm run test:watch
npm run test:e2e    # Electron + Playwright E2E
npm run test:e2e:debug
npm run check       # typecheck -> lint -> test -> build
```

E2E tests build the app first, then launch it through Playwright.

## Release Flow

Recommended release flow:

```bash
npm run release:patch   # or release:minor / release:major
git push origin main
git push origin --tags
```

The release scripts run the full local validation flow first, then create the version commit and tag with `npm version`.
Pushing a `v*` tag triggers the release workflow, which builds platform artifacts and creates a draft GitHub Release.

## Project Structure

```text
src/
  main/        Electron main process, IPC, services, system collection
  preload/     contextBridge API exposed to the renderer
  renderer/    React UI, pages, stores, components
  shared/      IPC channels, shared types, constants, contracts
tests/
  unit/        unit tests
  integration/ integration tests
  e2e/         Playwright-based Electron E2E tests
```

## Tech Stack

| Area | Tech |
|------|------|
| Framework | Electron 41, React 19 |
| Language | TypeScript |
| Build | Vite / electron-vite |
| State | Zustand |
| Charts | Recharts |
| System info | systeminformation |
| Settings | electron-store |
| Testing | Vitest, Playwright |

## Security Model

The renderer does not access Node APIs directly.

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- only explicit IPC APIs are exposed through `contextBridge`
- deletion paths are constrained and items are moved to Trash instead of being hard-deleted

## Platform Notes

- SystemScope supports both macOS and Windows.
- macOS includes APFS and unified-memory related corrections.
- Windows includes platform-specific handling for Quick Scan, app uninstall flows, Explorer opening, and tray behavior.
- Some system paths are intentionally restricted to open-only or trash-only flows for safety.

See [docs/features.md](docs/features.md) for more platform-specific details.

## Contributing

Issues and pull requests are welcome. Before opening a PR, please make sure the full validation flow passes:

```bash
npm run check
```

## License

[Apache License 2.0](LICENSE)
