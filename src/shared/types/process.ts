export interface ProcessInfo {
  pid: number
  ppid: number
  parentName: string | null
  descendantCount: number
  name: string
  cpu: number
  cpuAverage5m: number | null
  cpuPeak5m: number | null
  cpuObservedMs: number
  memory: number
  memoryBytes: number
  startedAt: number | null
  uptimeMs: number | null
  state: string
  user: string
  command: string
}

export interface ProcessSnapshot {
  allProcesses: ProcessInfo[]
  topCpuProcesses: ProcessInfo[]
  topMemoryProcesses: ProcessInfo[]
}

export interface PortInfo {
  protocol: string
  localAddress: string
  localPort: string
  peerAddress: string
  peerPort: string
  state: string
  pid: number
  process: string
  localPortNum: number  // 정렬/필터용
}

export interface ProcessKillRequest {
  pid: number
  name?: string
  command?: string
  reason?: string
  tree?: boolean
}

export interface ProcessKillResult {
  pid: number
  name: string
  killed: boolean
  forced: boolean
  cancelled: boolean
  killedPids: number[]
}

export interface ProcessNetworkUsage {
  pid: number
  name: string
  rxBps: number | null      // null when no prior baseline (first tick / new PID)
  txBps: number | null
  totalRxBytes: number | null    // null on platforms without nettop (e.g. Windows)
  totalTxBytes: number | null
}

export interface ProcessNetworkSnapshot {
  supported: boolean        // supported on macOS and Windows
  capturedAt: number        // ms since epoch
  intervalSec: number | null  // seconds since previous snapshot, or null on first call
  processes: ProcessNetworkUsage[]
}
