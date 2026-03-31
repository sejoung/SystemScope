# Phase 4: Operations & Sharing Enhancement Design

## Overview

Phase 4 adds two features to SystemScope:
1. **Diagnostic Report Export** - Export system diagnostics as Markdown/JSON for sharing
2. **Session Snapshot** - Save system state at a point in time and compare snapshots

## 1. Diagnostic Report Export

### Purpose
Enable users to save and share system diagnostic information for GitHub issues, personal records, or team comparison.

### Data Sources
- System summary (systemMonitor)
- Recent metrics history (metricsStore)
- Active alerts (alertManager)
- Top processes by CPU/memory (processMonitor)
- Disk cleanup candidates (cleanupInbox)
- Docker reclaimable space (dockerImages)
- Diagnosis results (diagnosisAdvisor)

### Export Formats
- **Markdown**: Human-readable, GitHub issue friendly
- **JSON**: Machine-readable, compatible with session snapshots

### Privacy Masking
Single toggle option that:
- Replaces home directory path with `~`
- Replaces OS username with `<user>`

### Files
- `src/shared/types/report.ts` - ReportOptions, DiagnosticReport types
- `src/main/services/reportBuilder.ts` - Collects data, builds report object
- `src/main/ipc/report.ipc.ts` - IPC handlers
- `src/renderer/src/features/report/ExportReportDialog.tsx` - Export dialog UI
- `src/renderer/src/features/report/ReportPreview.tsx` - Preview before save

### IPC Channels
- `buildDiagnosticReport(options: ReportOptions)` → `AppResult<DiagnosticReport>`
- `saveDiagnosticReport(options: SaveReportOptions)` → `AppResult<{ filePath: string }>`

### Report Options
```typescript
interface ReportOptions {
  sections: {
    systemSummary: boolean
    recentHistory: boolean
    activeAlerts: boolean
    topProcesses: boolean
    diskCleanup: boolean
    dockerReclaim: boolean
    diagnosis: boolean
  }
  maskSensitivePaths: boolean
}

interface SaveReportOptions {
  report: DiagnosticReport
  format: 'markdown' | 'json'
  filePath: string
}
```

### Acceptance Criteria
- Report generation failure does not corrupt user data
- Markdown output is human-readable
- Masking replaces all home path and username occurrences
- User can select which sections to include

---

## 2. Session Snapshot

### Purpose
Save current system state at a specific moment for later review or comparison.

### Saved Data
- System summary (CPU, memory, disk, GPU, network)
- Top 10 processes by CPU and memory
- Disk usage summary
- Active alerts
- Docker status (images, containers, volumes count + total size)

### Storage
- Reuses `persistentStore.ts` pattern
- Max 50 snapshots, 90-day retention
- Stored in app data directory as JSON

### Comparison (Diff)
Select two snapshots to see:
- CPU/memory/disk usage change (delta + direction)
- Process changes (new, removed, changed resource usage)
- Alert changes
- Docker size changes

### Files
- `src/shared/types/sessionSnapshot.ts` - SessionSnapshot, SnapshotDiff types
- `src/main/services/sessionSnapshotStore.ts` - Save, load, delete, compare
- `src/main/ipc/sessionSnapshot.ipc.ts` - IPC handlers
- `src/renderer/src/stores/useSessionSnapshotStore.ts` - Zustand store
- `src/renderer/src/features/sessionSnapshot/SnapshotButton.tsx` - Save button
- `src/renderer/src/features/sessionSnapshot/SnapshotList.tsx` - Snapshot list
- `src/renderer/src/features/sessionSnapshot/SnapshotDiffView.tsx` - Diff view

### IPC Channels
- `saveSessionSnapshot(label?: string)` → `AppResult<SessionSnapshot>`
- `getSessionSnapshots()` → `AppResult<SessionSnapshot[]>`
- `getSessionSnapshotDiff(id1: string, id2: string)` → `AppResult<SnapshotDiff>`
- `deleteSessionSnapshot(id: string)` → `AppResult<void>`

### Types
```typescript
interface SessionSnapshot {
  id: string
  label: string
  timestamp: number
  system: {
    cpuUsage: number
    memoryUsage: number
    memoryTotal: number
    diskUsage: number
    diskTotal: number
    gpuUsage?: number
    networkRxSec: number
    networkTxSec: number
  }
  topProcesses: { name: string; pid: number; cpu: number; memory: number }[]
  activeAlerts: { type: string; severity: string; message: string }[]
  docker?: {
    imagesCount: number
    containersCount: number
    volumesCount: number
    totalSize: number
  }
}

interface SnapshotDiff {
  snapshot1: { id: string; label: string; timestamp: number }
  snapshot2: { id: string; label: string; timestamp: number }
  system: Record<string, { before: number; after: number; delta: number }>
  processChanges: {
    added: string[]
    removed: string[]
    changed: { name: string; cpuDelta: number; memoryDelta: number }[]
  }
  alertChanges: {
    added: string[]
    removed: string[]
  }
  dockerDelta?: Record<string, { before: number; after: number; delta: number }>
}
```

### Acceptance Criteria
- Snapshot saves in under 2 seconds
- Snapshot list shows label, timestamp, key metrics summary
- Diff clearly shows increases (red) and decreases (green)
- Deleting a snapshot does not affect other snapshots

---

## 3. UI Integration

### Dashboard
- "Save Snapshot" button in dashboard header area
- "Export Report" button near settings/actions area

### Timeline Page
- Snapshot list as a sub-section or tab
- Snapshot diff view accessible from snapshot list

### Settings
- No new settings needed (masking is per-export toggle)

---

## 4. i18n

Both English and Korean translations for all new UI strings, following existing `src/shared/i18n/` patterns.
