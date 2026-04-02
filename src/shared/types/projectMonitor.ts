export interface ProjectMonitorWorkspace {
  path: string
  name: string
  exists: boolean
  currentSize: number
  previousSize: number | null
  recentGrowthBytes: number
  lastScannedAt: number | null
}

export interface ProjectMonitorSummary {
  workspaces: ProjectMonitorWorkspace[]
  totalSize: number
  totalRecentGrowthBytes: number
  scannedAt: number
}
