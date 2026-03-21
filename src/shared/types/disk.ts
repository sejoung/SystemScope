export interface FolderNode {
  name: string
  path: string
  size: number
  children: FolderNode[]
  isFile: boolean
}

export interface LargeFile {
  name: string
  path: string
  size: number
  modified: number
}

export interface ExtensionGroup {
  extension: string
  totalSize: number
  count: number
}

export interface DiskScanResult {
  rootPath: string
  tree: FolderNode
  totalSize: number
  fileCount: number
  folderCount: number
  scanDuration: number
}

export interface UserSpaceEntry {
  name: string
  path: string
  size: number
  icon: string
}

export interface UserSpaceInfo {
  homePath: string
  homeSize: number
  diskTotal: number
  diskAvailable: number
  diskUsage: number
  purgeable: number | null
  entries: UserSpaceEntry[]
}

export interface RecentGrowthEntry {
  name: string
  path: string
  recentSize: number
  totalSize: number
  recentFiles: number
  oldestRecent: number
}

export type ScanCategory = 'system' | 'homebrew' | 'devtools' | 'packages' | 'containers' | 'browsers'

export interface QuickScanFolder {
  name: string
  path: string
  description: string
  size: number
  exists: boolean
  cleanable: boolean
  category: ScanCategory
}

export interface GrowthFolder {
  name: string
  path: string
  addedSize: number      // 기간 내 추가/수정된 파일 총 크기
  addedFiles: number     // 기간 내 추가/수정된 파일 수
  totalSize: number      // 폴더 전체 크기
  growthRate: number     // addedSize / totalSize (0~1)
}

export interface GrowthViewResult {
  period: string         // '1h' | '24h' | '7d'
  cutoffMs: number
  folders: GrowthFolder[]
  totalAdded: number
  totalAddedFiles: number
}

export interface DuplicateGroup {
  hash: string
  size: number
  files: { name: string; path: string; modified: number }[]
  totalWaste: number
}

export interface TrashResult {
  successCount: number
  failCount: number
  totalSize: number
  errors: string[]
}
