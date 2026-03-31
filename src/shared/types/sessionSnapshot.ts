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
