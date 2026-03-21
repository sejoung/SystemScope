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

export interface DuplicateGroup {
  hash: string
  size: number
  files: { name: string; path: string; modified: number }[]
  totalWaste: number
}
