# Phase 4: Operations & Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add diagnostic report export (Markdown/JSON) and session snapshot save/compare features to SystemScope.

**Architecture:** Two independent feature tracks sharing the existing IPC + PersistentStore patterns. Report builder collects data from existing services and formats output. Session snapshot store persists point-in-time system state and computes diffs between snapshots.

**Tech Stack:** Electron IPC, PersistentStore, Zustand, React, TypeScript, Vitest

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/shared/types/report.ts` | Report types (ReportOptions, DiagnosticReport, SaveReportOptions) |
| `src/shared/types/sessionSnapshot.ts` | Snapshot types (SessionSnapshot, SnapshotDiff) |
| `src/main/services/reportBuilder.ts` | Collect data from services, build report, mask paths, render Markdown |
| `src/main/services/sessionSnapshotStore.ts` | Save/load/delete/diff snapshots via PersistentStore |
| `src/main/ipc/report.ipc.ts` | IPC handlers for report build + save |
| `src/main/ipc/sessionSnapshot.ipc.ts` | IPC handlers for snapshot CRUD + diff |
| `src/renderer/src/stores/useSessionSnapshotStore.ts` | Zustand store for snapshot list + diff state |
| `src/renderer/src/features/report/ExportReportDialog.tsx` | Export dialog with section checkboxes, masking toggle, format picker |
| `src/renderer/src/features/sessionSnapshot/SnapshotButton.tsx` | "Save Snapshot" button with label input |
| `src/renderer/src/features/sessionSnapshot/SnapshotList.tsx` | List of saved snapshots with select/delete |
| `src/renderer/src/features/sessionSnapshot/SnapshotDiffView.tsx` | Side-by-side diff display |
| `tests/unit/reportBuilder.test.ts` | Unit tests for report builder |
| `tests/unit/sessionSnapshotStore.test.ts` | Unit tests for snapshot store |

### Modified Files
| File | Changes |
|------|---------|
| `src/shared/types/index.ts` | Add exports for report and sessionSnapshot types |
| `src/shared/types/guards.ts` | Add type guards for new types |
| `src/shared/types/ipc.ts` | Add new error codes if needed |
| `src/shared/contracts/channels.ts` | Add 6 new IPC channel constants |
| `src/shared/contracts/systemScope.ts` | Add 6 new API methods to interface |
| `src/preload/createIpcApi.ts` | Wire up 6 new IPC methods |
| `src/main/ipc/index.ts` | Register new IPC handlers |
| `src/main/services/dataDir.ts` | Add snapshot file path getter |
| `src/shared/i18n/locales/en.ts` | Add English translations |
| `src/shared/i18n/locales/ko.ts` | Add Korean translations |
| `src/renderer/src/pages/DashboardPage.tsx` | Add SnapshotButton and ExportReportDialog trigger |
| `src/renderer/src/pages/TimelinePage.tsx` | Add Snapshots tab with list + diff |

---

## Task 1: Shared Types — Report & Session Snapshot

**Files:**
- Create: `src/shared/types/report.ts`
- Create: `src/shared/types/sessionSnapshot.ts`
- Modify: `src/shared/types/index.ts`

- [ ] **Step 1: Create report types**

Create `src/shared/types/report.ts`:

```typescript
export interface ReportSections {
  systemSummary: boolean
  recentHistory: boolean
  activeAlerts: boolean
  topProcesses: boolean
  diskCleanup: boolean
  dockerReclaim: boolean
  diagnosis: boolean
}

export interface ReportOptions {
  sections: ReportSections
  maskSensitivePaths: boolean
}

export interface DiagnosticReportData {
  generatedAt: number
  appVersion: string
  platform: string
  arch: string
  sections: DiagnosticReportSection[]
}

export interface DiagnosticReportSection {
  key: keyof ReportSections
  title: string
  content: string
  data: unknown
}

export interface SaveReportOptions {
  report: DiagnosticReportData
  format: 'markdown' | 'json'
}
```

- [ ] **Step 2: Create session snapshot types**

Create `src/shared/types/sessionSnapshot.ts`:

```typescript
export interface SessionSnapshotProcess {
  name: string
  pid: number
  cpu: number
  memory: number
}

export interface SessionSnapshotDocker {
  imagesCount: number
  containersCount: number
  volumesCount: number
  totalSize: number
}

export interface SessionSnapshot {
  id: string
  label: string
  timestamp: number
  system: {
    cpuUsage: number
    memoryUsage: number
    memoryTotal: number
    diskUsage: number
    diskTotal: number
    gpuUsage: number | null
    networkRxSec: number
    networkTxSec: number
  }
  topProcesses: SessionSnapshotProcess[]
  activeAlerts: { type: string; severity: string; message: string }[]
  docker: SessionSnapshotDocker | null
}

export interface SnapshotDiffDelta {
  before: number
  after: number
  delta: number
}

export interface SnapshotDiff {
  snapshot1: { id: string; label: string; timestamp: number }
  snapshot2: { id: string; label: string; timestamp: number }
  system: Record<string, SnapshotDiffDelta>
  processChanges: {
    added: string[]
    removed: string[]
    changed: { name: string; cpuDelta: number; memoryDelta: number }[]
  }
  alertChanges: {
    added: string[]
    removed: string[]
  }
  dockerDelta: Record<string, SnapshotDiffDelta> | null
}
```

- [ ] **Step 3: Export new types from barrel**

Add to `src/shared/types/index.ts`:

```typescript
export * from './report'
export * from './sessionSnapshot'
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/report.ts src/shared/types/sessionSnapshot.ts src/shared/types/index.ts
git commit -m "feat: add shared types for diagnostic report and session snapshot"
```

---

## Task 2: Type Guards for New Types

**Files:**
- Modify: `src/shared/types/guards.ts`

- [ ] **Step 1: Add type guards**

Append to `src/shared/types/guards.ts` (after the last export, before the closing of the file):

```typescript
/** DiagnosticReportData */
export function isDiagnosticReportData(data: unknown): data is import('./report').DiagnosticReportData {
  return isObj(data) && typeof data.generatedAt === 'number' && typeof data.appVersion === 'string' && Array.isArray(data.sections)
}

/** SessionSnapshot */
export function isSessionSnapshot(data: unknown): data is import('./sessionSnapshot').SessionSnapshot {
  return isObj(data) && typeof data.id === 'string' && typeof data.label === 'string' && typeof data.timestamp === 'number' && isObj(data.system)
}

/** SessionSnapshot[] */
export function isSessionSnapshotArray(data: unknown): data is import('./sessionSnapshot').SessionSnapshot[] {
  return Array.isArray(data) && (data.length === 0 || isSessionSnapshot(data[0]))
}

/** SnapshotDiff */
export function isSnapshotDiff(data: unknown): data is import('./sessionSnapshot').SnapshotDiff {
  return isObj(data) && isObj(data.snapshot1) && isObj(data.snapshot2) && isObj(data.system) && isObj(data.processChanges) && isObj(data.alertChanges)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/guards.ts
git commit -m "feat: add type guards for report and session snapshot"
```

---

## Task 3: IPC Channels & Contract

**Files:**
- Modify: `src/shared/contracts/channels.ts`
- Modify: `src/shared/contracts/systemScope.ts`

- [ ] **Step 1: Add IPC channel constants**

Add to `src/shared/contracts/channels.ts` before the `// 실시간 이벤트` comment:

```typescript
  // 진단 리포트
  REPORT_BUILD: 'report:build',
  REPORT_SAVE: 'report:save',

  // 세션 스냅샷
  SNAPSHOT_SAVE: 'snapshot:save',
  SNAPSHOT_GET_ALL: 'snapshot:getAll',
  SNAPSHOT_DELETE: 'snapshot:delete',
  SNAPSHOT_DIFF: 'snapshot:diff',
```

- [ ] **Step 2: Update SystemScopeApi interface**

Add imports to `src/shared/contracts/systemScope.ts`:

```typescript
import type {
  // ... existing imports ...
  ReportOptions,
  DiagnosticReportData,
  SaveReportOptions,
  SessionSnapshot,
  SnapshotDiff
} from '@shared/types'
```

Add methods to the `SystemScopeApi` interface (before the closing `}`):

```typescript
  buildDiagnosticReport: (options: ReportOptions) => Promise<AppResult<DiagnosticReportData>>
  saveDiagnosticReport: (options: SaveReportOptions) => Promise<AppResult<{ filePath: string }>>

  saveSessionSnapshot: (label?: string) => Promise<AppResult<SessionSnapshot>>
  getSessionSnapshots: () => Promise<AppResult<SessionSnapshot[]>>
  deleteSessionSnapshot: (id: string) => Promise<AppResult<boolean>>
  getSessionSnapshotDiff: (id1: string, id2: string) => Promise<AppResult<SnapshotDiff>>
```

- [ ] **Step 3: Wire up preload IPC API**

Add imports to `src/preload/createIpcApi.ts`:

```typescript
import type { AppUninstallRequest, CleanupRuleConfig, TrashItemsRequest, TimelineRange, EventQueryOptions, ReportOptions, SaveReportOptions } from "@shared/types";
```

Add methods inside the `return { ... }` object in `createIpcApi()`:

```typescript
    buildDiagnosticReport: (options: ReportOptions) =>
      invokeWithRequestId(IPC_CHANNELS.REPORT_BUILD, options),
    saveDiagnosticReport: (options: SaveReportOptions) =>
      invokeWithRequestId(IPC_CHANNELS.REPORT_SAVE, options),

    saveSessionSnapshot: (label?: string) =>
      invokeWithRequestId(IPC_CHANNELS.SNAPSHOT_SAVE, label),
    getSessionSnapshots: () =>
      invokeWithRequestId(IPC_CHANNELS.SNAPSHOT_GET_ALL),
    deleteSessionSnapshot: (id: string) =>
      invokeWithRequestId(IPC_CHANNELS.SNAPSHOT_DELETE, id),
    getSessionSnapshotDiff: (id1: string, id2: string) =>
      invokeWithRequestId(IPC_CHANNELS.SNAPSHOT_DIFF, id1, id2),
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/contracts/channels.ts src/shared/contracts/systemScope.ts src/preload/createIpcApi.ts
git commit -m "feat: add IPC channels and API contract for report and snapshot"
```

---

## Task 4: Data Directory — Snapshot File Path

**Files:**
- Modify: `src/main/services/dataDir.ts`

- [ ] **Step 1: Add snapshot file path getter**

Add to `src/main/services/dataDir.ts`:

```typescript
function getSessionSnapshotsFilePath(): string {
  return path.join(getDataDir(), 'session-snapshots.json')
}
```

Update the export statement to include `getSessionSnapshotsFilePath`.

- [ ] **Step 2: Commit**

```bash
git add src/main/services/dataDir.ts
git commit -m "feat: add session snapshots file path to dataDir"
```

---

## Task 5: Report Builder Service

**Files:**
- Create: `src/main/services/reportBuilder.ts`
- Create: `tests/unit/reportBuilder.test.ts`

- [ ] **Step 1: Write failing test for path masking**

Create `tests/unit/reportBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { maskSensitivePaths } from '../../src/main/services/reportBuilder'

describe('reportBuilder', () => {
  describe('maskSensitivePaths', () => {
    it('replaces home directory with ~', () => {
      const input = '/Users/testuser/Documents/project'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('~/Documents/project')
    })

    it('replaces username with <user>', () => {
      const input = 'Owner: testuser running process'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('Owner: <user> running process')
    })

    it('handles multiple occurrences', () => {
      const input = '/Users/testuser/a and /Users/testuser/b'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('~/a and ~/b')
    })

    it('returns original string when no match', () => {
      const input = '/opt/data/file.txt'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('/opt/data/file.txt')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reportBuilder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write report builder service**

Create `src/main/services/reportBuilder.ts`:

```typescript
import * as os from 'node:os'
import { app, dialog } from 'electron'
import * as fsp from 'node:fs/promises'
import type { ReportOptions, DiagnosticReportData, DiagnosticReportSection, ReportSections, SaveReportOptions } from '@shared/types'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses, getTopMemoryProcesses } from './processMonitor'
import { getDiagnosisSummary } from './diagnosisAdvisor'
import { getActiveAlerts } from './alertManager'
import { getCleanupInbox } from './cleanupInbox'
import { listDockerImages, listDockerContainers, listDockerVolumes } from './dockerImages'
import { getRecentMetricPoints } from './metricsStore'
import { logInfo, logError } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

export function maskSensitivePaths(text: string, homePath: string, username: string): string {
  let result = text
  if (homePath) {
    result = result.replaceAll(homePath, '~')
  }
  if (username) {
    result = result.replaceAll(username, '<user>')
  }
  return result
}

function maybeApplyMask(text: string, shouldMask: boolean): string {
  if (!shouldMask) return text
  return maskSensitivePaths(text, os.homedir(), os.userInfo().username)
}

export async function buildDiagnosticReport(options: ReportOptions): Promise<DiagnosticReportData> {
  const sections: DiagnosticReportSection[] = []
  const mask = options.maskSensitivePaths

  if (options.sections.systemSummary) {
    const stats = await getSystemStats()
    const content = [
      `CPU: ${stats.cpu.usage.toFixed(1)}% (${stats.cpu.model})`,
      `Memory: ${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)} (${stats.memory.usage.toFixed(1)}%)`,
      `Swap: ${formatBytes(stats.memory.swapUsed)} / ${formatBytes(stats.memory.swapTotal)}`,
      ...stats.disk.drives.map((d) =>
        `Disk ${maybeApplyMask(d.mount, mask)}: ${formatBytes(d.used)} / ${formatBytes(d.size)} (${d.usage.toFixed(1)}%)`
      ),
      `Network: ↓${formatBytes(stats.network.downloadBytesPerSecond ?? 0)}/s ↑${formatBytes(stats.network.uploadBytesPerSecond ?? 0)}/s`,
    ].join('\n')
    sections.push({ key: 'systemSummary', title: 'System Summary', content, data: stats })
  }

  if (options.sections.recentHistory) {
    const points = await getRecentMetricPoints(12)
    const content = points.map((p) =>
      `${new Date(p.ts).toLocaleString()} — CPU: ${p.cpu.toFixed(1)}% | Mem: ${p.memory.toFixed(1)}%`
    ).join('\n')
    sections.push({ key: 'recentHistory', title: 'Recent History (last 12 points)', content, data: points })
  }

  if (options.sections.activeAlerts) {
    const alerts = await getActiveAlerts()
    const content = alerts.length === 0
      ? 'No active alerts.'
      : alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.type}: ${a.message}`).join('\n')
    sections.push({ key: 'activeAlerts', title: 'Active Alerts', content, data: alerts })
  }

  if (options.sections.topProcesses) {
    const cpuTop = await getTopCpuProcesses(10)
    const memTop = await getTopMemoryProcesses(10)
    const lines = [
      '### Top CPU',
      ...cpuTop.map((p) => `${maybeApplyMask(p.name, mask)} (PID ${p.pid}): ${p.cpu.toFixed(1)}% CPU`),
      '',
      '### Top Memory',
      ...memTop.map((p) => `${maybeApplyMask(p.name, mask)} (PID ${p.pid}): ${formatBytes(p.memoryBytes)} (${p.memory.toFixed(1)}%)`),
    ]
    sections.push({ key: 'topProcesses', title: 'Top Processes', content: lines.join('\n'), data: { cpuTop, memTop } })
  }

  if (options.sections.diskCleanup) {
    const inbox = await getCleanupInbox()
    const content = inbox.items.length === 0
      ? 'No cleanup candidates.'
      : [
          `Total reclaimable: ${formatBytes(inbox.totalReclaimable)}`,
          '',
          ...inbox.items.slice(0, 20).map((item) =>
            `[${item.safetyLevel}] ${maybeApplyMask(item.path, mask)} — ${formatBytes(item.size)}`
          ),
        ].join('\n')
    sections.push({ key: 'diskCleanup', title: 'Disk Cleanup Candidates', content, data: inbox })
  }

  if (options.sections.dockerReclaim) {
    try {
      const images = await listDockerImages()
      const containers = await listDockerContainers()
      const volumes = await listDockerVolumes()
      const content = [
        `Images: ${images.images.length} (${formatBytes(images.totalSize)})`,
        `Containers: ${containers.containers.length}`,
        `Volumes: ${volumes.volumes.length} (${formatBytes(volumes.totalSize)})`,
      ].join('\n')
      sections.push({ key: 'dockerReclaim', title: 'Docker Resources', content, data: { images, containers, volumes } })
    } catch {
      sections.push({ key: 'dockerReclaim', title: 'Docker Resources', content: 'Docker not available.', data: null })
    }
  }

  if (options.sections.diagnosis) {
    const summary = await getDiagnosisSummary()
    const content = summary.results.length === 0
      ? 'No issues detected.'
      : summary.results.map((r) => {
          const evidenceStr = r.evidence.map((e) => `  - ${e.label}: ${e.value}${e.threshold ? ` (threshold: ${e.threshold})` : ''}`).join('\n')
          return `[${r.severity.toUpperCase()}] ${r.title}\n${r.description}\n${evidenceStr}`
        }).join('\n\n')
    sections.push({ key: 'diagnosis', title: 'Diagnosis', content, data: summary })
  }

  logInfo('report-builder', 'Report built', { sectionCount: sections.length })

  return {
    generatedAt: Date.now(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    sections,
  }
}

export function renderReportAsMarkdown(report: DiagnosticReportData): string {
  const lines: string[] = [
    '# SystemScope Diagnostic Report',
    '',
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `App Version: ${report.appVersion}`,
    `Platform: ${report.platform} (${report.arch})`,
    '',
    '---',
    '',
  ]

  for (const section of report.sections) {
    lines.push(`## ${section.title}`, '', section.content, '', '---', '')
  }

  return lines.join('\n')
}

export async function saveDiagnosticReport(options: SaveReportOptions): Promise<string> {
  const defaultName = `systemscope-report-${new Date().toISOString().slice(0, 10)}`
  const ext = options.format === 'markdown' ? 'md' : 'json'

  const result = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.${ext}`,
    filters: options.format === 'markdown'
      ? [{ name: 'Markdown', extensions: ['md'] }]
      : [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePath) {
    throw new Error('Save cancelled')
  }

  const content = options.format === 'markdown'
    ? renderReportAsMarkdown(options.report)
    : JSON.stringify(options.report, null, 2)

  await fsp.writeFile(result.filePath, content, 'utf-8')
  logInfo('report-builder', 'Report saved', { filePath: result.filePath, format: options.format })

  return result.filePath
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reportBuilder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/reportBuilder.ts tests/unit/reportBuilder.test.ts
git commit -m "feat: implement report builder service with path masking"
```

---

## Task 6: Session Snapshot Store Service

**Files:**
- Create: `src/main/services/sessionSnapshotStore.ts`
- Create: `tests/unit/sessionSnapshotStore.test.ts`

- [ ] **Step 1: Write failing test for snapshot diff**

Create `tests/unit/sessionSnapshotStore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeSnapshotDiff } from '../../src/main/services/sessionSnapshotStore'
import type { SessionSnapshot } from '../../src/shared/types'

const makeSnapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  id: 'snap-1',
  label: 'Test',
  timestamp: 1000,
  system: {
    cpuUsage: 50,
    memoryUsage: 60,
    memoryTotal: 16_000_000_000,
    diskUsage: 70,
    diskTotal: 500_000_000_000,
    gpuUsage: null,
    networkRxSec: 1000,
    networkTxSec: 500,
  },
  topProcesses: [
    { name: 'chrome', pid: 100, cpu: 30, memory: 20 },
    { name: 'node', pid: 200, cpu: 10, memory: 15 },
  ],
  activeAlerts: [{ type: 'cpu', severity: 'warning', message: 'CPU high' }],
  docker: { imagesCount: 5, containersCount: 2, volumesCount: 3, totalSize: 1_000_000_000 },
  ...overrides,
})

describe('sessionSnapshotStore', () => {
  describe('computeSnapshotDiff', () => {
    it('computes system metric deltas', () => {
      const snap1 = makeSnapshot({ id: 's1', system: { ...makeSnapshot().system, cpuUsage: 40 } })
      const snap2 = makeSnapshot({ id: 's2', system: { ...makeSnapshot().system, cpuUsage: 80 } })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.system.cpuUsage.before).toBe(40)
      expect(diff.system.cpuUsage.after).toBe(80)
      expect(diff.system.cpuUsage.delta).toBe(40)
    })

    it('detects added and removed processes', () => {
      const snap1 = makeSnapshot({
        id: 's1',
        topProcesses: [{ name: 'chrome', pid: 100, cpu: 30, memory: 20 }],
      })
      const snap2 = makeSnapshot({
        id: 's2',
        topProcesses: [{ name: 'firefox', pid: 300, cpu: 25, memory: 18 }],
      })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.processChanges.added).toContain('firefox')
      expect(diff.processChanges.removed).toContain('chrome')
    })

    it('detects alert changes', () => {
      const snap1 = makeSnapshot({
        id: 's1',
        activeAlerts: [{ type: 'cpu', severity: 'warning', message: 'CPU high' }],
      })
      const snap2 = makeSnapshot({
        id: 's2',
        activeAlerts: [{ type: 'memory', severity: 'critical', message: 'Memory full' }],
      })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.alertChanges.added).toContain('memory')
      expect(diff.alertChanges.removed).toContain('cpu')
    })

    it('handles null docker in either snapshot', () => {
      const snap1 = makeSnapshot({ id: 's1', docker: null })
      const snap2 = makeSnapshot({ id: 's2' })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.dockerDelta).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sessionSnapshotStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write session snapshot store service**

Create `src/main/services/sessionSnapshotStore.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import { PersistentStore } from './persistentStore'
import { getSessionSnapshotsFilePath } from './dataDir'
import { getSystemStats } from './systemMonitor'
import { getTopCpuProcesses, getTopMemoryProcesses } from './processMonitor'
import { getActiveAlerts } from './alertManager'
import { listDockerImages, listDockerContainers, listDockerVolumes } from './dockerImages'
import { logInfo, logError } from './logging'
import type { SessionSnapshot, SnapshotDiff, SnapshotDiffDelta } from '@shared/types'

const SCHEMA_VERSION = 1
const MAX_SNAPSHOTS = 50
const MS_PER_DAY = 24 * 60 * 60 * 1000
const RETENTION_DAYS = 90

let store: PersistentStore<SessionSnapshot> | null = null

function getStore(): PersistentStore<SessionSnapshot> {
  if (!store) {
    store = new PersistentStore<SessionSnapshot>({
      filePath: getSessionSnapshotsFilePath(),
      schemaVersion: SCHEMA_VERSION,
      maxEntries: MAX_SNAPSHOTS,
      maxAgeMs: RETENTION_DAYS * MS_PER_DAY,
      getTimestamp: (entry) => entry.timestamp,
    })
  }
  return store
}

export async function saveSessionSnapshot(label?: string): Promise<SessionSnapshot> {
  const stats = await getSystemStats()
  const cpuTop = await getTopCpuProcesses(10)
  const memTop = await getTopMemoryProcesses(10)
  const alerts = await getActiveAlerts()

  const topProcesses = [...cpuTop, ...memTop]
    .filter((p, i, arr) => arr.findIndex((x) => x.pid === p.pid) === i)
    .slice(0, 10)
    .map((p) => ({ name: p.name, pid: p.pid, cpu: p.cpu, memory: p.memory }))

  let docker: SessionSnapshot['docker'] = null
  try {
    const images = await listDockerImages()
    const containers = await listDockerContainers()
    const volumes = await listDockerVolumes()
    docker = {
      imagesCount: images.images.length,
      containersCount: containers.containers.length,
      volumesCount: volumes.volumes.length,
      totalSize: images.totalSize + volumes.totalSize,
    }
  } catch {
    // Docker not available
  }

  const primaryDrive = stats.disk.drives[0]

  const snapshot: SessionSnapshot = {
    id: randomUUID(),
    label: label || `Snapshot ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    system: {
      cpuUsage: stats.cpu.usage,
      memoryUsage: stats.memory.usage,
      memoryTotal: stats.memory.total,
      diskUsage: primaryDrive?.usage ?? 0,
      diskTotal: primaryDrive?.size ?? 0,
      gpuUsage: stats.gpu.usage,
      networkRxSec: stats.network.downloadBytesPerSecond ?? 0,
      networkTxSec: stats.network.uploadBytesPerSecond ?? 0,
    },
    topProcesses,
    activeAlerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
    docker,
  }

  await getStore().append(snapshot)
  logInfo('session-snapshot', 'Snapshot saved', { id: snapshot.id, label: snapshot.label })

  return snapshot
}

export async function getSessionSnapshots(): Promise<SessionSnapshot[]> {
  const entries = await getStore().load()
  return [...entries].sort((a, b) => b.timestamp - a.timestamp)
}

export async function deleteSessionSnapshot(id: string): Promise<boolean> {
  const s = getStore()
  const entries = await s.load()
  const filtered = entries.filter((e) => e.id !== id)
  if (filtered.length === entries.length) return false

  await s.clear()
  if (filtered.length > 0) {
    await s.appendBatch(filtered)
  }
  logInfo('session-snapshot', 'Snapshot deleted', { id })
  return true
}

function makeDelta(before: number, after: number): SnapshotDiffDelta {
  return { before, after, delta: after - before }
}

export function computeSnapshotDiff(snap1: SessionSnapshot, snap2: SessionSnapshot): SnapshotDiff {
  const s1 = snap1.system
  const s2 = snap2.system

  const system: Record<string, SnapshotDiffDelta> = {
    cpuUsage: makeDelta(s1.cpuUsage, s2.cpuUsage),
    memoryUsage: makeDelta(s1.memoryUsage, s2.memoryUsage),
    memoryTotal: makeDelta(s1.memoryTotal, s2.memoryTotal),
    diskUsage: makeDelta(s1.diskUsage, s2.diskUsage),
    diskTotal: makeDelta(s1.diskTotal, s2.diskTotal),
    networkRxSec: makeDelta(s1.networkRxSec, s2.networkRxSec),
    networkTxSec: makeDelta(s1.networkTxSec, s2.networkTxSec),
  }

  // Process changes
  const names1 = new Set(snap1.topProcesses.map((p) => p.name))
  const names2 = new Set(snap2.topProcesses.map((p) => p.name))
  const added = [...names2].filter((n) => !names1.has(n))
  const removed = [...names1].filter((n) => !names2.has(n))
  const changed: { name: string; cpuDelta: number; memoryDelta: number }[] = []

  for (const name of names1) {
    if (!names2.has(name)) continue
    const p1 = snap1.topProcesses.find((p) => p.name === name)!
    const p2 = snap2.topProcesses.find((p) => p.name === name)!
    const cpuDelta = p2.cpu - p1.cpu
    const memoryDelta = p2.memory - p1.memory
    if (Math.abs(cpuDelta) > 0.1 || Math.abs(memoryDelta) > 0.1) {
      changed.push({ name, cpuDelta, memoryDelta })
    }
  }

  // Alert changes
  const alertTypes1 = new Set(snap1.activeAlerts.map((a) => a.type))
  const alertTypes2 = new Set(snap2.activeAlerts.map((a) => a.type))
  const alertsAdded = [...alertTypes2].filter((t) => !alertTypes1.has(t))
  const alertsRemoved = [...alertTypes1].filter((t) => !alertTypes2.has(t))

  // Docker delta
  let dockerDelta: Record<string, SnapshotDiffDelta> | null = null
  if (snap1.docker && snap2.docker) {
    dockerDelta = {
      imagesCount: makeDelta(snap1.docker.imagesCount, snap2.docker.imagesCount),
      containersCount: makeDelta(snap1.docker.containersCount, snap2.docker.containersCount),
      volumesCount: makeDelta(snap1.docker.volumesCount, snap2.docker.volumesCount),
      totalSize: makeDelta(snap1.docker.totalSize, snap2.docker.totalSize),
    }
  }

  return {
    snapshot1: { id: snap1.id, label: snap1.label, timestamp: snap1.timestamp },
    snapshot2: { id: snap2.id, label: snap2.label, timestamp: snap2.timestamp },
    system,
    processChanges: { added, removed, changed },
    alertChanges: { added: alertsAdded, removed: alertsRemoved },
    dockerDelta,
  }
}

export async function getSessionSnapshotDiff(id1: string, id2: string): Promise<SnapshotDiff | null> {
  const entries = await getStore().load()
  const snap1 = entries.find((e) => e.id === id1)
  const snap2 = entries.find((e) => e.id === id2)
  if (!snap1 || !snap2) return null

  return computeSnapshotDiff(snap1, snap2)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/sessionSnapshotStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/sessionSnapshotStore.ts tests/unit/sessionSnapshotStore.test.ts
git commit -m "feat: implement session snapshot store with diff computation"
```

---

## Task 7: IPC Handlers — Report & Snapshot

**Files:**
- Create: `src/main/ipc/report.ipc.ts`
- Create: `src/main/ipc/sessionSnapshot.ipc.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1: Create report IPC handler**

Create `src/main/ipc/report.ipc.ts`:

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import type { ReportOptions, SaveReportOptions } from '@shared/types'
import { buildDiagnosticReport, saveDiagnosticReport } from '../services/reportBuilder'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerReportIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORT_BUILD, async (_event, options: ReportOptions, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const report = await buildDiagnosticReport(options)
      logInfoAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { sectionCount: report.sections.length }))
      return success(report)
    } catch (err) {
      logErrorAction('report-ipc', 'report.build', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to build diagnostic report')
    }
  })

  ipcMain.handle(IPC_CHANNELS.REPORT_SAVE, async (_event, options: SaveReportOptions, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const filePath = await saveDiagnosticReport(options)
      logInfoAction('report-ipc', 'report.save', withRequestMeta(requestMeta, { filePath, format: options.format }))
      return success({ filePath })
    } catch (err) {
      const message = err instanceof Error && err.message === 'Save cancelled' ? 'Save cancelled' : 'Failed to save report'
      logErrorAction('report-ipc', 'report.save', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', message)
    }
  })
}
```

- [ ] **Step 2: Create session snapshot IPC handler**

Create `src/main/ipc/sessionSnapshot.ipc.ts`:

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { saveSessionSnapshot, getSessionSnapshots, deleteSessionSnapshot, getSessionSnapshotDiff } from '../services/sessionSnapshotStore'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerSessionSnapshotIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_SAVE, async (_event, label?: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const snapshot = await saveSessionSnapshot(label ?? undefined)
      logInfoAction('snapshot-ipc', 'snapshot.save', withRequestMeta(requestMeta, { id: snapshot.id }))
      return success(snapshot)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.save', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to save session snapshot')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_GET_ALL, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const snapshots = await getSessionSnapshots()
      logInfoAction('snapshot-ipc', 'snapshot.getAll', withRequestMeta(requestMeta, { count: snapshots.length }))
      return success(snapshots)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.getAll', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get session snapshots')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_DELETE, async (_event, id: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id || typeof id !== 'string') {
        return failure('INVALID_INPUT', 'Snapshot ID is required')
      }
      const deleted = await deleteSessionSnapshot(id)
      logInfoAction('snapshot-ipc', 'snapshot.delete', withRequestMeta(requestMeta, { id, deleted }))
      return success(deleted)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.delete', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to delete session snapshot')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SNAPSHOT_DIFF, async (_event, id1: string, id2: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      if (!id1 || !id2 || typeof id1 !== 'string' || typeof id2 !== 'string') {
        return failure('INVALID_INPUT', 'Two snapshot IDs are required')
      }
      const diff = await getSessionSnapshotDiff(id1, id2)
      if (!diff) {
        return failure('INVALID_INPUT', 'One or both snapshots not found')
      }
      logInfoAction('snapshot-ipc', 'snapshot.diff', withRequestMeta(requestMeta, { id1, id2 }))
      return success(diff)
    } catch (err) {
      logErrorAction('snapshot-ipc', 'snapshot.diff', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to compute snapshot diff')
    }
  })
}
```

- [ ] **Step 3: Register new IPC handlers**

In `src/main/ipc/index.ts`, add imports:

```typescript
import { registerReportIpc } from './report.ipc'
import { registerSessionSnapshotIpc } from './sessionSnapshot.ipc'
```

Add to `registerAllIpc()` body:

```typescript
  registerReportIpc()
  registerSessionSnapshotIpc()
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/report.ipc.ts src/main/ipc/sessionSnapshot.ipc.ts src/main/ipc/index.ts
git commit -m "feat: add IPC handlers for report and session snapshot"
```

---

## Task 8: i18n — English & Korean Translations

**Files:**
- Modify: `src/shared/i18n/locales/en.ts`
- Modify: `src/shared/i18n/locales/ko.ts`

- [ ] **Step 1: Add English translations**

Add to `EN_MESSAGES` in `src/shared/i18n/locales/en.ts`:

```typescript
  // Report
  "Export Report": "Export Report",
  "Export diagnostic report": "Export diagnostic report",
  "Select the sections to include in the report.": "Select the sections to include in the report.",
  "System Summary": "System Summary",
  "Recent History": "Recent History",
  "Active Alerts": "Active Alerts",
  "Top Processes": "Top Processes",
  "Disk Cleanup Candidates": "Disk Cleanup Candidates",
  "Docker Resources": "Docker Resources",
  Diagnosis: "Diagnosis",
  "Mask sensitive paths": "Mask sensitive paths",
  "Replaces home directory and username in the report.": "Replaces home directory and username in the report.",
  "Export as Markdown": "Export as Markdown",
  "Export as JSON": "Export as JSON",
  "Report saved successfully.": "Report saved successfully.",
  "Report generation failed.": "Report generation failed.",
  "Save cancelled.": "Save cancelled.",
  "Building report...": "Building report...",

  // Session Snapshot
  "Save Snapshot": "Save Snapshot",
  "Snapshot label": "Snapshot label",
  "Save current system state": "Save current system state",
  Snapshots: "Snapshots",
  "No snapshots saved yet.": "No snapshots saved yet.",
  "Delete snapshot": "Delete snapshot",
  "Compare snapshots": "Compare snapshots",
  "Select two snapshots to compare.": "Select two snapshots to compare.",
  "Snapshot saved.": "Snapshot saved.",
  "Snapshot deleted.": "Snapshot deleted.",
  "Saving snapshot...": "Saving snapshot...",
  "snapshot.diff.before": "Before",
  "snapshot.diff.after": "After",
  "snapshot.diff.delta": "Change",
  "snapshot.diff.processes.added": "New Processes",
  "snapshot.diff.processes.removed": "Gone Processes",
  "snapshot.diff.processes.changed": "Changed Processes",
  "snapshot.diff.alerts.added": "New Alerts",
  "snapshot.diff.alerts.removed": "Resolved Alerts",
  "snapshot.diff.docker": "Docker Changes",
```

- [ ] **Step 2: Add Korean translations**

Add to `KO_MESSAGES` in `src/shared/i18n/locales/ko.ts`:

```typescript
  // Report
  "Export Report": "리포트 내보내기",
  "Export diagnostic report": "진단 리포트 내보내기",
  "Select the sections to include in the report.": "리포트에 포함할 섹션을 선택하세요.",
  "System Summary": "시스템 요약",
  "Recent History": "최근 히스토리",
  "Active Alerts": "활성 알림",
  "Top Processes": "상위 프로세스",
  "Disk Cleanup Candidates": "디스크 정리 후보",
  "Docker Resources": "Docker 리소스",
  Diagnosis: "진단",
  "Mask sensitive paths": "민감 경로 마스킹",
  "Replaces home directory and username in the report.": "리포트에서 홈 디렉토리와 사용자명을 치환합니다.",
  "Export as Markdown": "Markdown으로 내보내기",
  "Export as JSON": "JSON으로 내보내기",
  "Report saved successfully.": "리포트가 저장되었습니다.",
  "Report generation failed.": "리포트 생성에 실패했습니다.",
  "Save cancelled.": "저장이 취소되었습니다.",
  "Building report...": "리포트 생성 중...",

  // Session Snapshot
  "Save Snapshot": "스냅샷 저장",
  "Snapshot label": "스냅샷 이름",
  "Save current system state": "현재 시스템 상태 저장",
  Snapshots: "스냅샷",
  "No snapshots saved yet.": "저장된 스냅샷이 없습니다.",
  "Delete snapshot": "스냅샷 삭제",
  "Compare snapshots": "스냅샷 비교",
  "Select two snapshots to compare.": "비교할 스냅샷 두 개를 선택하세요.",
  "Snapshot saved.": "스냅샷이 저장되었습니다.",
  "Snapshot deleted.": "스냅샷이 삭제되었습니다.",
  "Saving snapshot...": "스냅샷 저장 중...",
  "snapshot.diff.before": "이전",
  "snapshot.diff.after": "이후",
  "snapshot.diff.delta": "변화",
  "snapshot.diff.processes.added": "새 프로세스",
  "snapshot.diff.processes.removed": "종료된 프로세스",
  "snapshot.diff.processes.changed": "변경된 프로세스",
  "snapshot.diff.alerts.added": "새 알림",
  "snapshot.diff.alerts.removed": "해제된 알림",
  "snapshot.diff.docker": "Docker 변경",
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/i18n/locales/en.ts src/shared/i18n/locales/ko.ts
git commit -m "feat: add i18n translations for report and session snapshot"
```

---

## Task 9: Zustand Store — Session Snapshot

**Files:**
- Create: `src/renderer/src/stores/useSessionSnapshotStore.ts`

- [ ] **Step 1: Create session snapshot store**

Create `src/renderer/src/stores/useSessionSnapshotStore.ts`:

```typescript
import { create } from 'zustand'
import type { SessionSnapshot, SnapshotDiff } from '@shared/types'
import { isSessionSnapshotArray, isSessionSnapshot, isSnapshotDiff } from '@shared/types/guards'

interface SessionSnapshotState {
  snapshots: SessionSnapshot[]
  loading: boolean
  error: string | null
  diff: SnapshotDiff | null
  diffLoading: boolean
  selectedIds: string[]

  fetchSnapshots: () => Promise<void>
  saveSnapshot: (label?: string) => Promise<SessionSnapshot | null>
  deleteSnapshot: (id: string) => Promise<boolean>
  toggleSelection: (id: string) => void
  clearSelection: () => void
  computeDiff: () => Promise<void>
}

export const useSessionSnapshotStore = create<SessionSnapshotState>((set, get) => ({
  snapshots: [],
  loading: false,
  error: null,
  diff: null,
  diffLoading: false,
  selectedIds: [],

  fetchSnapshots: async () => {
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.getSessionSnapshots()
      if (res.ok && isSessionSnapshotArray(res.data)) {
        set({ snapshots: res.data, loading: false })
      } else {
        set({ loading: false, error: res.ok ? 'Invalid snapshot data' : res.error.message })
      }
    } catch {
      set({ loading: false, error: 'Failed to fetch snapshots' })
    }
  },

  saveSnapshot: async (label?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await window.systemScope.saveSessionSnapshot(label)
      if (res.ok && isSessionSnapshot(res.data)) {
        set((state) => ({
          snapshots: [res.data, ...state.snapshots],
          loading: false,
        }))
        return res.data
      }
      set({ loading: false, error: res.ok ? 'Invalid snapshot data' : res.error.message })
      return null
    } catch {
      set({ loading: false, error: 'Failed to save snapshot' })
      return null
    }
  },

  deleteSnapshot: async (id: string) => {
    try {
      const res = await window.systemScope.deleteSessionSnapshot(id)
      if (res.ok) {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
          diff: state.diff && (state.diff.snapshot1.id === id || state.diff.snapshot2.id === id) ? null : state.diff,
        }))
        return true
      }
      return false
    } catch {
      return false
    }
  },

  toggleSelection: (id: string) => {
    set((state) => {
      const selected = state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : state.selectedIds.length < 2
          ? [...state.selectedIds, id]
          : [state.selectedIds[1], id]
      return { selectedIds: selected, diff: null }
    })
  },

  clearSelection: () => set({ selectedIds: [], diff: null }),

  computeDiff: async () => {
    const { selectedIds } = get()
    if (selectedIds.length !== 2) return

    set({ diffLoading: true })
    try {
      const res = await window.systemScope.getSessionSnapshotDiff(selectedIds[0], selectedIds[1])
      if (res.ok && isSnapshotDiff(res.data)) {
        set({ diff: res.data, diffLoading: false })
      } else {
        set({ diffLoading: false })
      }
    } catch {
      set({ diffLoading: false })
    }
  },
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/stores/useSessionSnapshotStore.ts
git commit -m "feat: add Zustand store for session snapshots"
```

---

## Task 10: UI — Export Report Dialog

**Files:**
- Create: `src/renderer/src/features/report/ExportReportDialog.tsx`

- [ ] **Step 1: Create export report dialog component**

Create `src/renderer/src/features/report/ExportReportDialog.tsx`:

```typescript
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'
import type { ReportSections, DiagnosticReportData } from '@shared/types'
import { isDiagnosticReportData } from '@shared/types/guards'

interface ExportReportDialogProps {
  open: boolean
  onClose: () => void
}

const SECTION_KEYS: { key: keyof ReportSections; labelKey: string }[] = [
  { key: 'systemSummary', labelKey: 'System Summary' },
  { key: 'recentHistory', labelKey: 'Recent History' },
  { key: 'activeAlerts', labelKey: 'Active Alerts' },
  { key: 'topProcesses', labelKey: 'Top Processes' },
  { key: 'diskCleanup', labelKey: 'Disk Cleanup Candidates' },
  { key: 'dockerReclaim', labelKey: 'Docker Resources' },
  { key: 'diagnosis', labelKey: 'Diagnosis' },
]

export function ExportReportDialog({ open, onClose }: ExportReportDialogProps) {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)

  const [sections, setSections] = useState<ReportSections>({
    systemSummary: true,
    recentHistory: true,
    activeAlerts: true,
    topProcesses: true,
    diskCleanup: true,
    dockerReclaim: true,
    diagnosis: true,
  })
  const [maskPaths, setMaskPaths] = useState(true)
  const [building, setBuilding] = useState(false)

  if (!open) return null

  const toggleSection = (key: keyof ReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleExport = async (format: 'markdown' | 'json') => {
    setBuilding(true)
    try {
      const buildRes = await window.systemScope.buildDiagnosticReport({
        sections,
        maskSensitivePaths: maskPaths,
      })

      if (!buildRes.ok || !isDiagnosticReportData(buildRes.data)) {
        showToast(t('Report generation failed.'), 'error')
        setBuilding(false)
        return
      }

      const saveRes = await window.systemScope.saveDiagnosticReport({
        report: buildRes.data,
        format,
      })

      if (saveRes.ok) {
        showToast(t('Report saved successfully.'), 'success')
        onClose()
      } else if (saveRes.error.message === 'Save cancelled') {
        showToast(t('Save cancelled.'), 'info')
      } else {
        showToast(t('Report generation failed.'), 'error')
      }
    } catch {
      showToast(t('Report generation failed.'), 'error')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
          {t('Export diagnostic report')}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {t('Select the sections to include in the report.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {SECTION_KEYS.map(({ key, labelKey }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggleSection(key)}
              />
              {t(labelKey)}
            </label>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={maskPaths}
              onChange={() => setMaskPaths((v) => !v)}
            />
            {t('Mask sensitive paths')}
          </label>
          <p style={{ margin: '4px 0 0 24px', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {t('Replaces home directory and username in the report.')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('Cancel')}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {building ? t('Building report...') : t('Export as JSON')}
          </button>
          <button
            onClick={() => handleExport('markdown')}
            disabled={building}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {building ? t('Building report...') : t('Export as Markdown')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/features/report/ExportReportDialog.tsx
git commit -m "feat: add ExportReportDialog UI component"
```

---

## Task 11: UI — Session Snapshot Components

**Files:**
- Create: `src/renderer/src/features/sessionSnapshot/SnapshotButton.tsx`
- Create: `src/renderer/src/features/sessionSnapshot/SnapshotList.tsx`
- Create: `src/renderer/src/features/sessionSnapshot/SnapshotDiffView.tsx`

- [ ] **Step 1: Create SnapshotButton component**

Create `src/renderer/src/features/sessionSnapshot/SnapshotButton.tsx`:

```typescript
import { useState } from 'react'
import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'

export function SnapshotButton() {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)
  const saveSnapshot = useSessionSnapshotStore((s) => s.saveSnapshot)
  const loading = useSessionSnapshotStore((s) => s.loading)
  const [showInput, setShowInput] = useState(false)
  const [label, setLabel] = useState('')

  const handleSave = async () => {
    const result = await saveSnapshot(label.trim() || undefined)
    if (result) {
      showToast(t('Snapshot saved.'), 'success')
      setLabel('')
      setShowInput(false)
    }
  }

  if (showInput) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('Snapshot label')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontSize: 12, width: 160,
          }}
        />
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          {loading ? t('Saving snapshot...') : t('Save Snapshot')}
        </button>
        <button
          onClick={() => { setShowInput(false); setLabel('') }}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'transparent', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          {t('Cancel')}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      title={t('Save current system state')}
      style={{
        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
        cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {t('Save Snapshot')}
    </button>
  )
}
```

- [ ] **Step 2: Create SnapshotList component**

Create `src/renderer/src/features/sessionSnapshot/SnapshotList.tsx`:

```typescript
import { useEffect } from 'react'
import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { useToast } from '../../components/Toast'
import { formatBytes } from '@shared/utils/formatBytes'

export function SnapshotList() {
  const { t } = useI18n()
  const showToast = useToast((s) => s.show)
  const snapshots = useSessionSnapshotStore((s) => s.snapshots)
  const loading = useSessionSnapshotStore((s) => s.loading)
  const selectedIds = useSessionSnapshotStore((s) => s.selectedIds)
  const fetchSnapshots = useSessionSnapshotStore((s) => s.fetchSnapshots)
  const deleteSnapshot = useSessionSnapshotStore((s) => s.deleteSnapshot)
  const toggleSelection = useSessionSnapshotStore((s) => s.toggleSelection)
  const computeDiff = useSessionSnapshotStore((s) => s.computeDiff)

  useEffect(() => { fetchSnapshots() }, [fetchSnapshots])

  const handleDelete = async (id: string) => {
    const ok = await deleteSnapshot(id)
    if (ok) showToast(t('Snapshot deleted.'), 'success')
  }

  const handleCompare = () => {
    if (selectedIds.length === 2) computeDiff()
  }

  if (loading && snapshots.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading...</p>
  }

  if (snapshots.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('No snapshots saved yet.')}</p>
  }

  return (
    <div>
      {selectedIds.length === 2 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleCompare}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-on-accent)',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('Compare snapshots')}
          </button>
        </div>
      )}

      {selectedIds.length < 2 && snapshots.length >= 2 && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {t('Select two snapshots to compare.')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {snapshots.map((snap) => {
          const isSelected = selectedIds.includes(snap.id)
          return (
            <div
              key={snap.id}
              onClick={() => toggleSelection(snap.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8,
                border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                cursor: 'pointer', fontSize: 13, transition: 'border 0.15s',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{snap.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {new Date(snap.timestamp).toLocaleString()} — CPU {snap.system.cpuUsage.toFixed(0)}% | Mem {snap.system.memoryUsage.toFixed(0)}% | Disk {snap.system.diskUsage.toFixed(0)}%
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(snap.id) }}
                title={t('Delete snapshot')}
                style={{
                  padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 11,
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SnapshotDiffView component**

Create `src/renderer/src/features/sessionSnapshot/SnapshotDiffView.tsx`:

```typescript
import { useSessionSnapshotStore } from '../../stores/useSessionSnapshotStore'
import { useI18n } from '../../i18n/useI18n'
import { formatBytes } from '@shared/utils/formatBytes'
import type { SnapshotDiffDelta } from '@shared/types'

function DeltaCell({ delta, isPercent, isBytes }: { delta: SnapshotDiffDelta; isPercent?: boolean; isBytes?: boolean }) {
  const sign = delta.delta > 0 ? '+' : ''
  const color = delta.delta > 0 ? 'var(--status-error, #e74c3c)' : delta.delta < 0 ? 'var(--status-success, #2ecc71)' : 'var(--text-secondary)'

  const fmt = (v: number) => {
    if (isBytes) return formatBytes(v)
    if (isPercent) return `${v.toFixed(1)}%`
    return v.toFixed(1)
  }

  return (
    <td style={{ padding: '4px 8px', fontSize: 12 }}>
      {fmt(delta.before)} → {fmt(delta.after)}{' '}
      <span style={{ color, fontWeight: 600 }}>
        ({sign}{isBytes ? formatBytes(delta.delta) : isPercent ? `${delta.delta.toFixed(1)}%` : delta.delta.toFixed(1)})
      </span>
    </td>
  )
}

export function SnapshotDiffView() {
  const { t } = useI18n()
  const diff = useSessionSnapshotStore((s) => s.diff)
  const diffLoading = useSessionSnapshotStore((s) => s.diffLoading)

  if (diffLoading) return <p style={{ fontSize: 13 }}>Computing diff...</p>
  if (!diff) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {diff.snapshot1.label} vs {diff.snapshot2.label}
      </h4>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Metric</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>{t('snapshot.diff.before')} → {t('snapshot.diff.after')} ({t('snapshot.diff.delta')})</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: '4px 8px' }}>CPU</td><DeltaCell delta={diff.system.cpuUsage} isPercent /></tr>
          <tr><td style={{ padding: '4px 8px' }}>Memory</td><DeltaCell delta={diff.system.memoryUsage} isPercent /></tr>
          <tr><td style={{ padding: '4px 8px' }}>Disk</td><DeltaCell delta={diff.system.diskUsage} isPercent /></tr>
          <tr><td style={{ padding: '4px 8px' }}>Network ↓</td><DeltaCell delta={diff.system.networkRxSec} isBytes /></tr>
          <tr><td style={{ padding: '4px 8px' }}>Network ↑</td><DeltaCell delta={diff.system.networkTxSec} isBytes /></tr>
        </tbody>
      </table>

      {(diff.processChanges.added.length > 0 || diff.processChanges.removed.length > 0 || diff.processChanges.changed.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {diff.processChanges.added.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{t('snapshot.diff.processes.added')}:</strong> {diff.processChanges.added.join(', ')}
            </p>
          )}
          {diff.processChanges.removed.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{t('snapshot.diff.processes.removed')}:</strong> {diff.processChanges.removed.join(', ')}
            </p>
          )}
          {diff.processChanges.changed.length > 0 && (
            <div style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{t('snapshot.diff.processes.changed')}:</strong>
              {diff.processChanges.changed.map((c) => (
                <span key={c.name} style={{ marginLeft: 8 }}>
                  {c.name} (CPU {c.cpuDelta > 0 ? '+' : ''}{c.cpuDelta.toFixed(1)}%, Mem {c.memoryDelta > 0 ? '+' : ''}{c.memoryDelta.toFixed(1)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(diff.alertChanges.added.length > 0 || diff.alertChanges.removed.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          {diff.alertChanges.added.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{t('snapshot.diff.alerts.added')}:</strong> {diff.alertChanges.added.join(', ')}
            </p>
          )}
          {diff.alertChanges.removed.length > 0 && (
            <p style={{ fontSize: 12, margin: '4px 0' }}>
              <strong>{t('snapshot.diff.alerts.removed')}:</strong> {diff.alertChanges.removed.join(', ')}
            </p>
          )}
        </div>
      )}

      {diff.dockerDelta && (
        <div>
          <strong style={{ fontSize: 12 }}>{t('snapshot.diff.docker')}:</strong>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
            <tbody>
              <tr><td style={{ padding: '2px 8px' }}>Images</td><DeltaCell delta={diff.dockerDelta.imagesCount} /></tr>
              <tr><td style={{ padding: '2px 8px' }}>Containers</td><DeltaCell delta={diff.dockerDelta.containersCount} /></tr>
              <tr><td style={{ padding: '2px 8px' }}>Volumes</td><DeltaCell delta={diff.dockerDelta.volumesCount} /></tr>
              <tr><td style={{ padding: '2px 8px' }}>Total Size</td><DeltaCell delta={diff.dockerDelta.totalSize} isBytes /></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/features/sessionSnapshot/SnapshotButton.tsx src/renderer/src/features/sessionSnapshot/SnapshotList.tsx src/renderer/src/features/sessionSnapshot/SnapshotDiffView.tsx
git commit -m "feat: add session snapshot UI components"
```

---

## Task 12: Integrate into Dashboard and Timeline Pages

**Files:**
- Modify: `src/renderer/src/pages/DashboardPage.tsx`
- Modify: `src/renderer/src/pages/TimelinePage.tsx`

- [ ] **Step 1: Add buttons to DashboardPage**

Add imports to `DashboardPage.tsx`:

```typescript
import { SnapshotButton } from "../features/sessionSnapshot/SnapshotButton";
import { ExportReportDialog } from "../features/report/ExportReportDialog";
```

Add state inside the `DashboardPage` function:

```typescript
const [reportDialogOpen, setReportDialogOpen] = useState(false);
```

Add `useState` to the existing React import if not already there.

Inside the header area (after the `<h2>` block and description), add:

```tsx
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <SnapshotButton />
  <button
    onClick={() => setReportDialogOpen(true)}
    style={{
      padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
      backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)",
      cursor: "pointer", fontSize: 12,
    }}
  >
    {t("Export Report")}
  </button>
</div>

<ExportReportDialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} />
```

- [ ] **Step 2: Add Snapshots tab to TimelinePage**

Add imports to `TimelinePage.tsx`:

```typescript
import { SnapshotList } from '../features/sessionSnapshot/SnapshotList'
import { SnapshotDiffView } from '../features/sessionSnapshot/SnapshotDiffView'
```

Add a tab for snapshots. In the tab bar section of TimelinePage, add a new tab "Snapshots" using the existing `PageTab` component pattern. Below the tab content, conditionally render:

```tsx
{activeTab === 'snapshots' && (
  <div>
    <SnapshotList />
    <SnapshotDiffView />
  </div>
)}
```

The exact integration depends on TimelinePage's current tab structure — check the existing tab rendering pattern and add accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/DashboardPage.tsx src/renderer/src/pages/TimelinePage.tsx
git commit -m "feat: integrate report export and snapshot UI into dashboard and timeline"
```

---

## Task 13: Build Verification & Final Test

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Fix any issues found**

If any test or build fails, fix the issues and commit.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 4 — diagnostic report export and session snapshot (v1.6)"
```
