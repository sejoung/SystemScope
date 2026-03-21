import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import * as fsSync from 'fs'

// ─── 최근 급성장 폴더 ───

export interface RecentGrowthEntry {
  name: string
  path: string
  recentSize: number    // 최근 N일 내 추가/수정된 파일 크기
  totalSize: number     // 폴더 전체 크기
  recentFiles: number   // 최근 추가/수정된 파일 수
  oldestRecent: number  // 가장 오래된 최근 파일 mtime
}

export async function findRecentGrowth(
  folderPath: string,
  days: number = 7,
  signal?: AbortSignal
): Promise<RecentGrowthEntry[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const results = new Map<string, RecentGrowthEntry>()

  await walkForGrowth(folderPath, folderPath, cutoff, results, 0, 4, signal)

  return Array.from(results.values())
    .filter((e) => e.recentSize > 0)
    .sort((a, b) => b.recentSize - a.recentSize)
    .slice(0, 30)
}

async function walkForGrowth(
  rootPath: string,
  dirPath: string,
  cutoff: number,
  results: Map<string, RecentGrowthEntry>,
  depth: number,
  maxDepth: number,
  signal?: AbortSignal
): Promise<{ totalSize: number; recentSize: number; recentFiles: number }> {
  if (signal?.aborted) throw new Error('Cancelled')

  let totalSize = 0
  let recentSize = 0
  let recentFiles = 0

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return { totalSize: 0, recentSize: 0, recentFiles: 0 }
  }

  for (const entry of entries) {
    if (signal?.aborted) throw new Error('Cancelled')
    const fullPath = path.join(dirPath, entry.name)

    try {
      if (entry.isSymbolicLink()) continue

      if (entry.isFile()) {
        const stat = await fs.stat(fullPath)
        totalSize += stat.size
        if (stat.mtimeMs >= cutoff) {
          recentSize += stat.size
          recentFiles++
        }
      } else if (entry.isDirectory() && depth < maxDepth) {
        const sub = await walkForGrowth(rootPath, fullPath, cutoff, results, depth + 1, maxDepth, signal)
        totalSize += sub.totalSize

        // depth 1 기준으로 결과 집계 (홈 바로 아래 폴더별)
        if (depth === 0 && sub.recentSize > 0) {
          results.set(fullPath, {
            name: entry.name,
            path: fullPath,
            recentSize: sub.recentSize,
            totalSize: sub.totalSize,
            recentFiles: sub.recentFiles,
            oldestRecent: cutoff
          })
        } else {
          recentSize += sub.recentSize
          recentFiles += sub.recentFiles
        }
      }
    } catch {
      // skip inaccessible
    }
  }

  return { totalSize, recentSize, recentFiles }
}

// ─── 중복 파일 찾기 ───

export interface DuplicateGroup {
  hash: string
  size: number
  files: { name: string; path: string; modified: number }[]
  totalWaste: number  // (count - 1) * size
}

export async function findDuplicates(
  folderPath: string,
  minSize: number = 1024 * 100, // 100KB 이상만
  signal?: AbortSignal
): Promise<DuplicateGroup[]> {
  // 1단계: 파일 크기별 그룹핑 (빠름)
  const sizeMap = new Map<number, { name: string; path: string; modified: number }[]>()
  await collectFilesBySize(folderPath, sizeMap, minSize, 0, 5, signal)

  // 같은 크기 파일이 2개 이상인 것만 후보
  const candidates: { name: string; path: string; modified: number; size: number }[] = []
  for (const [size, files] of sizeMap) {
    if (files.length >= 2) {
      for (const f of files) {
        candidates.push({ ...f, size })
      }
    }
  }

  if (candidates.length === 0) return []

  // 2단계: 해시 비교 (후보만)
  const hashMap = new Map<string, { name: string; path: string; modified: number; size: number }[]>()

  for (const file of candidates) {
    if (signal?.aborted) throw new Error('Cancelled')
    try {
      const hash = await hashFile(file.path, file.size)
      const key = `${file.size}:${hash}`
      const group = hashMap.get(key) ?? []
      group.push(file)
      hashMap.set(key, group)
    } catch {
      // skip unreadable
    }
  }

  // 2개 이상인 그룹만 반환
  const results: DuplicateGroup[] = []
  for (const [key, files] of hashMap) {
    if (files.length >= 2) {
      const size = files[0].size
      results.push({
        hash: key.split(':')[1],
        size,
        files: files.map((f) => ({ name: f.name, path: f.path, modified: f.modified })),
        totalWaste: (files.length - 1) * size
      })
    }
  }

  return results.sort((a, b) => b.totalWaste - a.totalWaste).slice(0, 50)
}

async function collectFilesBySize(
  dirPath: string,
  sizeMap: Map<number, { name: string; path: string; modified: number }[]>,
  minSize: number,
  depth: number,
  maxDepth: number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Cancelled')
  if (depth > maxDepth) return

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (signal?.aborted) throw new Error('Cancelled')
    const fullPath = path.join(dirPath, entry.name)

    try {
      if (entry.isSymbolicLink()) continue

      if (entry.isFile()) {
        const stat = await fs.stat(fullPath)
        if (stat.size >= minSize) {
          const group = sizeMap.get(stat.size) ?? []
          group.push({ name: entry.name, path: fullPath, modified: stat.mtimeMs })
          sizeMap.set(stat.size, group)
        }
      } else if (entry.isDirectory()) {
        await collectFilesBySize(fullPath, sizeMap, minSize, depth + 1, maxDepth, signal)
      }
    } catch {
      // skip
    }
  }
}

// 파일 해시: 작은 파일은 전체, 큰 파일은 head+tail 샘플링
async function hashFile(filePath: string, fileSize: number): Promise<string> {
  const SAMPLE_SIZE = 8192

  if (fileSize <= SAMPLE_SIZE * 2) {
    // 작은 파일: 전체 해시
    const data = await fs.readFile(filePath)
    return crypto.createHash('md5').update(data).digest('hex')
  }

  // 큰 파일: head + tail 샘플 해시 (속도 최적화)
  const hash = crypto.createHash('md5')
  const fd = await fs.open(filePath, 'r')
  try {
    const headBuf = Buffer.alloc(SAMPLE_SIZE)
    const tailBuf = Buffer.alloc(SAMPLE_SIZE)

    await fd.read(headBuf, 0, SAMPLE_SIZE, 0)
    await fd.read(tailBuf, 0, SAMPLE_SIZE, fileSize - SAMPLE_SIZE)

    hash.update(headBuf)
    hash.update(tailBuf)
    // 파일 크기도 해시에 포함 (다른 내용인데 head/tail만 같은 경우 방지)
    hash.update(Buffer.from(fileSize.toString()))
  } finally {
    await fd.close()
  }

  return hash.digest('hex')
}
