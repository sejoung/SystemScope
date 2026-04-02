export interface ProjectMonitorCategoryStat {
  category: 'dependencies' | 'build_outputs' | 'caches' | 'artifacts' | 'other'
  label: string
  size: number
}

export interface ProjectMonitorHistoryPoint {
  scannedAt: number
  size: number
}

export interface ProjectMonitorWorkspace {
  path: string
  name: string
  exists: boolean
  currentSize: number
  previousSize: number | null
  recentGrowthBytes: number
  lastScannedAt: number | null
  topCategories: ProjectMonitorCategoryStat[]
  history: ProjectMonitorHistoryPoint[]
}

export interface ProjectMonitorSummary {
  workspaces: ProjectMonitorWorkspace[]
  totalSize: number
  totalRecentGrowthBytes: number
  scannedAt: number
}
