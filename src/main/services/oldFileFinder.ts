import * as fs from 'fs/promises'
import * as path from 'path'
import type { LargeFile } from '@shared/types'

export async function findOldFiles(
  folderPath: string,
  olderThanDays: number = 365,
  minSizeBytes: number = 1024 * 1024, // 1MB
  limit: number = 50
): Promise<LargeFile[]> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const results: LargeFile[] = []

  await walk(folderPath, cutoff, minSizeBytes, results, 0, 5)

  results.sort((a, b) => a.modified - b.modified) // 가장 오래된 순
  return results.slice(0, limit)
}

async function walk(
  dirPath: string,
  cutoff: number,
  minSize: number,
  results: LargeFile[],
  depth: number,
  maxDepth: number
): Promise<void> {
  if (depth > maxDepth) return

  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    try {
      if (entry.isSymbolicLink()) continue

      if (entry.isFile()) {
        const stat = await fs.stat(fullPath)
        if (stat.mtimeMs < cutoff && stat.size >= minSize) {
          results.push({
            name: entry.name,
            path: fullPath,
            size: stat.size,
            modified: stat.mtimeMs
          })
        }
      } else if (entry.isDirectory()) {
        await walk(fullPath, cutoff, minSize, results, depth + 1, maxDepth)
      }
    } catch {
      // skip
    }
  }
}
