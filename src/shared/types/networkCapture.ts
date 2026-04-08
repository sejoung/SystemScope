export interface NetworkCaptureCapability {
  supported: boolean
  platform: 'mac' | 'win' | 'linux'
  mode: 'none' | 'metadata' | 'http_proxy'
  requiresInstall: boolean
  requiresApproval: boolean
  canInspectBodies: boolean
}

export type NetworkCaptureState =
  | 'unsupported'
  | 'helperNotInstalled'
  | 'approvalRequired'
  | 'helperDisconnected'
  | 'available'
  | 'starting'
  | 'running'
  | 'error'

export interface NetworkCaptureStatus {
  state: NetworkCaptureState
  running: boolean
  flowCount: number
  lastUpdatedAt: number | null
  message?: string
}

export interface NetworkFlowSummary {
  id: string
  pid: number | null
  processName: string | null
  direction: 'outbound' | 'inbound'
  protocol: 'tcp' | 'udp' | 'dns' | 'http' | 'https' | 'ws' | 'other'
  host: string | null
  ip: string | null
  port: number | null
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  rxBytes: number
  txBytes: number
  status: 'open' | 'closed' | 'failed'
  requestPath?: string | null
  method?: string | null
  statusCode?: number | null
  mimeType?: string | null
  initiator?: string | null
  scheme?: 'http' | 'https' | 'dns' | 'ws' | 'wss' | 'tcp' | 'udp' | 'other'
}

export interface NetworkCaptureUpdate {
  status: NetworkCaptureStatus
  recentFlows: NetworkFlowSummary[]
}
