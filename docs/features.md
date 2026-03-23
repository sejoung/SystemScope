# SystemScope Feature Reference

<p>
  <a href="./features.md">English</a> | <a href="./features.ko.md">한국어</a>
</p>

## 1. Real-Time System Monitoring

- CPU usage, per-core load, model, and clock speed
- Memory total / used / available plus real memory pressure
- GPU availability, memory usage, and temperature
- Disk usage overview
- 1-second live system updates
- Recent-history live charts

## 2. Alert System

- Warning / critical alerts for disk, memory, and GPU memory usage
- Thresholds are configurable per metric
- Settings persist across app restarts
- Cooldown logic prevents alert flooding

Default thresholds:

| Item | Warning | Critical |
|------|---------|----------|
| Disk | 80% | 90% |
| Memory | 80% | 90% |
| GPU Memory | 80% | 90% |

## 3. Disk Analysis

- Asynchronous scan for any selected folder
- Scan progress and cancellation support
- Treemap visualization
- Large file list
- Extension-based size breakdown
- Scan summary: total size, file count, folder count, duration

Scan characteristics:

- Max depth: `5`
- Batch concurrency: `50`
- Symbolic links are excluded from recursive traversal
- Inaccessible files and folders are skipped

## 4. Quick Cleanup Candidate Scan

Predefined paths are scanned to surface locations that commonly grow over time.

**macOS targets:**

- `~/Library/Caches`, `~/Library/Logs`, `~/Downloads`, `~/.Trash`
- Homebrew cache / logs / cellar
- Xcode DerivedData / Archives / CoreSimulator
- npm / yarn / pnpm / pip / Cargo / Gradle / Maven / CocoaPods / Composer caches
- Docker / OrbStack data
- Chrome / Safari caches

**Windows targets:**

- Temp, Downloads, Recycle Bin, Windows Update cache, Crash dumps
- Chrome / Edge cache
- npm / yarn / pnpm / pip / NuGet / Cargo / Gradle / Maven caches
- Docker data, VS Code extensions

Each item includes path, description, estimated size, category, and whether it is considered cleanable.

Notes:

- Path opening only works within approved safety roots.
- On Windows, system paths such as `Temp`, `Recycle Bin`, and `Windows Update cache` are explicitly allowed for Explorer opening.
- Size measurement prefers fast system commands first and falls back to JS recursive scanning when needed.

## 5. Docker Cleanup

Docker resources are managed from the dedicated `Docker` page.

- **Overview**: combined status summary and recommended cleanup order
- **Containers**: stop running containers and remove stopped ones
- **Images**: remove unused / dangling images
- **Volumes**: remove unused volumes
- **Build Cache**: prune reclaimable builder cache

Details:

- Uses `docker image ls`, `docker ps -a`, `docker volume ls`, and `docker system df`
- Shows repository, tag, size, created time, and status
- Status categories: `in use`, `unused`, `dangling` / `running`, `stopped`
- Resources in use are protected from deletion
- Supports bulk actions with confirmation dialogs
- Distinguishes between “Docker not installed” and “Docker daemon not running”
- If Docker CLI or daemon access is unavailable, the app fails gracefully with user-facing guidance

## 6. Growth View

Tracks home-folder growth over time using snapshots.

- Periodic JSON snapshots of folder sizes
- Compares older snapshots with the latest snapshot to calculate real growth
- Periods: 1 hour / 24 hours / 7 days
- “Top 5 fastest growing folders” bar chart
- Total added size and growth rate list

Snapshot settings:

- Stored at `userData/snapshots/growth.json`
- Default interval: 60 minutes
- Configurable from 15 minutes to 6 hours
- Max retention: 168 snapshots
- Corrupt JSON recovery and duplicate snapshot suppression

## 7. Recent Growth in a Scanned Folder

Finds folders inside a scanned path that recently grew based on modified files.

- Uses file `mtime`
- Groups by folder
- Adjustable period
- Open target folders in Finder / Explorer

## 8. Duplicate File Detection

Three-step duplicate detection:

1. Group by file size
2. Narrow candidates with sampled head+tail hashes
3. Confirm duplicates with full hashing

- Targets files >= 100 KB
- Up to 50 groups
- Shows reclaimable wasted space per group

### State Sync After Deletion

- Deleted items are removed from the list immediately
- Scan cache is invalidated
- Background refresh updates derived statistics

## 9. User Space Summary

Shows the size of major folders under the user’s home directory.

- macOS/Linux: prefers `du`, falls back when unavailable
- Windows: prefers system drive filesystem capacity
- Inaccessible folders are skipped

## 10. Process Monitoring

- Full process list where CPU or memory usage is greater than zero
- Search/filter by name, PID, or command path
- Sort by PID / name / CPU% / memory
- Process termination with protection for the app itself and protected targets
- Dashboard includes top CPU / memory / GPU resource consumers

## 11. Port Finder

Inspects active ports and owning processes.

- Search scope: Local / Remote / All
- State filters: All / Listening / Established / Other
- TCP states shown with status colors
- Kill process by PID from the port view
- Normalizes Windows `.exe` and macOS `.app` paths into display-friendly names

## 12. Port Watch

Monitors specific ports / IPs for connection state changes.

- Supports port number, IP, or IP:Port patterns
- Polling interval from 1 second to 30 seconds
- Toast notifications and history logs on state change
- Pause / resume support

## 13. Tray Icon

- Runs in the macOS menu bar / Windows system tray
- App can be restored after the window is closed
- macOS: template image + fixed-width CPU meter
- Windows: dynamically updated CPU usage icon states

## 14. Application Cleanup

- **Installed**: inspect installed apps, uninstall them, and review related data candidates
- **Leftover Data**: review leftover app data not currently linked to installed apps, with confidence / reason / risk guidance

## 15. Shutdown Handling

- Graceful shutdown orchestration: cancel jobs -> clear intervals -> wait for snapshots -> destroy tray
- Handles `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection`
- Shows a global renderer overlay during shutdown

## 16. Settings

- **Appearance**: dark / light theme
- **Alerts**: disk / memory / GPU warning and critical thresholds
- **Snapshots**: interval from 15 minutes to 6 hours
- **App Data / Logs**: inspect storage paths and open them in Finder / Explorer
- Logs stored at `userData/logs/systemscope-YYYY-MM-DD.log` with 10-day retention

## Testing

- Unit / integration: Vitest
- E2E: Playwright with Electron
- Covers major IPC flows, Docker state branching, external command fallbacks, and app management flows

## macOS-Specific Corrections

macOS can report memory and disk usage in ways that look fuller than what users expect, so the app applies corrections.

- Memory usage uses `(total - available) / total`
- APFS root volume correction uses `diskutil` container information
- Disk alerts use `realUsage` where available
- Apple Silicon GPU messaging explains unified-memory limitations
