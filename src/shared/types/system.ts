export interface CpuInfo {
  usage: number
  cores: number[]
  temperature: number | null
  model: string
  speed: number
}

export interface MemoryInfo {
  total: number
  used: number
  active: number
  available: number
  cached: number
  usage: number       // 실제 압박도: (total - available) / total
  swapTotal: number
  swapUsed: number
}

export interface GpuInfo {
  available: boolean
  model: string | null
  usage: number | null
  memoryTotal: number | null
  memoryUsed: number | null
  temperature: number | null
}

export interface DriveInfo {
  fs: string
  type: string
  size: number
  used: number
  available: number
  usage: number
  mount: string
  purgeable: number | null     // macOS: 제거 가능 공간 (OS가 자동 반환)
  realUsage: number | null     // macOS: purgeable 제외한 실제 사용률
}

export interface SystemStats {
  cpu: CpuInfo
  memory: MemoryInfo
  gpu: GpuInfo
  disk: { drives: DriveInfo[] }
  timestamp: number
}
