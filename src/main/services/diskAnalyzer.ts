import * as fs from 'fs/promises'
import * as path from 'path'
import type { FolderNode, LargeFile, ExtensionGroup, DiskScanResult } from '@shared/types'
import { SCAN_MAX_DEPTH, SCAN_CONCURRENCY, SCAN_LARGE_FILE_LIMIT } from '@shared/constants/thresholds'
import { getDirSize } from '../utils/getDirSize'

export async function scanFolder(
  folderPath: string,
  onProgress?: (current: string, fileCount: number) => void,
  signal?: AbortSignal,
  maxDepth: number = SCAN_MAX_DEPTH
): Promise<DiskScanResult> {
  const start = Date.now()
  let fileCount = 0
  let folderCount = 0
  let lastProgressTime = 0
  const PROGRESS_THROTTLE_MS = 100

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

    let entries
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch {
      return node
    }

    if (depth >= maxDepth) {
      // 최대 깊이 도달 시 파일 크기 합산 + 하위 디렉토리는 getDirSize로 측정
      const sizes = await Promise.all(
        entries.map(async (entry) => {
          try {
            const fullPath = path.join(dirPath, entry.name)
            if (entry.isSymbolicLink()) return 0
            if (entry.isFile()) {
              const stat = await fs.stat(fullPath)
              fileCount++
              return stat.size
            }
            if (entry.isDirectory()) {
              return getDirSize(fullPath)
            }
          } catch {
            // 접근 불가 항목 건너뜀
          }
          return 0
        })
      )
      node.size = sizes.reduce((a, b) => a + b, 0)
      return node
    }

    // 배치 단위로 처리
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
              const now = Date.now()
              if (now - lastProgressTime > PROGRESS_THROTTLE_MS) {
                onProgress?.(fullPath, fileCount)
                lastProgressTime = now
              }
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
            // 접근 불가 항목 건너뜀
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

    // 크기 기준 내림차순 정렬
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
      const ext = path.extname(node.name).toLowerCase() || '(확장자 없음)'
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
