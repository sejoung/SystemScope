export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  memoryBytes: number
  command: string
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
}

export interface ProcessKillResult {
  pid: number
  name: string
  killed: boolean
  cancelled: boolean
}
