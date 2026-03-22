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
  localPort: number
  peerAddress: string
  peerPort: number
  state: string
  pid: number
  process: string
}
