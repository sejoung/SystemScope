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
