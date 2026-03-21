import * as fs from 'fs/promises'
import * as path from 'path'
import si from 'systeminformation'
import type { FolderNode, LargeFile, ExtensionGroup, DiskScanResult, DriveInfo } from '@shared/types'
import { SCAN_MAX_DEPTH, SCAN_CONCURRENCY, SCAN_LARGE_FILE_LIMIT } from '@shared/constants/thresholds'

export async function getDrives(): Promise<DriveInfo[]> {
  const disks = await si.fsSize()
  return disks.map((d) => ({
    fs: d.fs,
    type: d.type,
    size: d.size,
    used: d.used,
    available: d.available,
    usage: Math.round(d.use * 100) / 100,
    mount: d.mount,
    purgeable: null,
    realUsage: null
  }))
}

export async function scanFolder(
  folderPath: string,
  onProgress?: (current: string, fileCount: number) => void,
  signal?: AbortSignal,
  maxDepth: number = SCAN_MAX_DEPTH
): Promise<DiskScanResult> {
  const start = Date.now()
  let fileCount = 0
  let folderCount = 0

  async function walk(dirPath: string, depth: number): Promise<FolderNode> {
    if (signal?.aborted) {
      throw new Error('Scan cancelled')
    }

    folderCount++
    const node: FolderNode = {
      name: path.basename(dirPath),
      path: dirPath,
      size: 0,
      children: [],
      isFile: false
    }

    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch {
      return node
    }

    if (depth >= maxDepth) {
      // At max depth, just sum sizes without recursing
      const sizes = await Promise.all(
        entries.map(async (entry) => {
          try {
            const fullPath = path.join(dirPath, entry.name)
            const stat = await fs.stat(fullPath)
            if (stat.isFile()) {
              fileCount++
            }
            return stat.isFile() ? stat.size : 0
          } catch {
            return 0
          }
        })
      )
      node.size = sizes.reduce((a, b) => a + b, 0)
      return node
    }

    // Process in batches
    const batches: typeof entries[] = []
    for (let i = 0; i < entries.length; i += SCAN_CONCURRENCY) {
      batches.push(entries.slice(i, i + SCAN_CONCURRENCY))
    }

    for (const batch of batches) {
      if (signal?.aborted) throw new Error('Scan cancelled')

      const results = await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name)
          try {
            if (entry.isSymbolicLink()) return null
            if (entry.isDirectory()) {
              onProgress?.(fullPath, fileCount)
              return walk(fullPath, depth + 1)
            }
            if (entry.isFile()) {
              const stat = await fs.stat(fullPath)
              fileCount++
              return {
                name: entry.name,
                path: fullPath,
                size: stat.size,
                children: [],
                isFile: true
              } satisfies FolderNode
            }
          } catch {
            // Skip inaccessible entries
          }
          return null
        })
      )

      for (const child of results) {
        if (child) {
          node.children.push(child)
          node.size += child.size
        }
      }
    }

    // Sort children by size desc
    node.children.sort((a, b) => b.size - a.size)

    return node
  }

  const tree = await walk(folderPath, 0)
  const scanDuration = Date.now() - start

  return {
    rootPath: folderPath,
    tree,
    totalSize: tree.size,
    fileCount,
    folderCount,
    scanDuration
  }
}

export function findLargeFiles(
  tree: FolderNode,
  limit: number = SCAN_LARGE_FILE_LIMIT
): LargeFile[] {
  const files: LargeFile[] = []

  function collect(node: FolderNode): void {
    if (node.isFile) {
      files.push({
        name: node.name,
        path: node.path,
        size: node.size,
        modified: 0
      })
    }
    for (const child of node.children) {
      collect(child)
    }
  }

  collect(tree)
  files.sort((a, b) => b.size - a.size)
  return files.slice(0, limit)
}

export function getExtensionBreakdown(tree: FolderNode): ExtensionGroup[] {
  const map = new Map<string, { totalSize: number; count: number }>()

  function collect(node: FolderNode): void {
    if (node.isFile) {
      const ext = path.extname(node.name).toLowerCase() || '(no ext)'
      const group = map.get(ext) ?? { totalSize: 0, count: 0 }
      group.totalSize += node.size
      group.count++
      map.set(ext, group)
    }
    for (const child of node.children) {
      collect(child)
    }
  }

  collect(tree)
  return Array.from(map.entries())
    .map(([extension, data]) => ({ extension, ...data }))
    .sort((a, b) => b.totalSize - a.totalSize)
}
