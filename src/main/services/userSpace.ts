import * as fs from 'fs/promises'
import * as path from 'path'
import { homedir, platform } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { UserSpaceEntry, UserSpaceInfo } from '@shared/types'

const execFileAsync = promisify(execFile)

export type { UserSpaceEntry, UserSpaceInfo }

function getHomeFolders(): { name: string; rel: string; icon: string }[] {
  if (platform() === 'darwin') {
    return [
      { name: 'Documents', rel: 'Documents', icon: '📄' },
      { name: 'Downloads', rel: 'Downloads', icon: '⬇' },
      { name: 'Desktop', rel: 'Desktop', icon: '🖥' },
      { name: 'Pictures', rel: 'Pictures', icon: '🖼' },
      { name: 'Movies', rel: 'Movies', icon: '🎬' },
      { name: 'Music', rel: 'Music', icon: '🎵' },
      { name: 'Developer', rel: 'Developer', icon: '⌨' },
      { name: 'Library', rel: 'Library', icon: '📚' },
      { name: '.Trash', rel: '.Trash', icon: '🗑' }
    ]
  }
  return [
    { name: 'Documents', rel: 'Documents', icon: '📄' },
    { name: 'Downloads', rel: 'Downloads', icon: '⬇' },
    { name: 'Desktop', rel: 'Desktop', icon: '🖥' },
    { name: 'Pictures', rel: 'Pictures', icon: '🖼' },
    { name: 'Videos', rel: 'Videos', icon: '🎬' },
    { name: 'Music', rel: 'Music', icon: '🎵' },
    { name: 'AppData', rel: 'AppData', icon: '📚' }
  ]
}

// macOS: 홈 디렉토리 전체를 한 번에 스캔
// -d 0: 각 인자의 총 크기만 출력 (내부 탐색은 하되 하위 목록은 안 줌)
async function getDirSizesBatchMac(paths: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  try {
    // du -sk path1 path2 path3... → 한 프로세스로 전부 측정
    const { stdout } = await execFileAsync('du', ['-sk', ...paths], {
      timeout: 60000,
      env: { ...process.env, LANG: 'C' },
      maxBuffer: 1024 * 1024
    })
    for (const line of stdout.trim().split('\n')) {
      const tabIdx = line.indexOf('\t')
      if (tabIdx === -1) continue
      const kb = parseInt(line.substring(0, tabIdx), 10)
      const p = line.substring(tabIdx + 1)
      if (!isNaN(kb)) result.set(p, kb * 1024)
    }
  } catch (err) {
    // partial results may be available in stderr with individual permission errors
    // du still outputs sizes for accessible paths
    const errObj = err as { stdout?: string }
    if (errObj.stdout) {
      for (const line of errObj.stdout.trim().split('\n')) {
        const tabIdx = line.indexOf('\t')
        if (tabIdx === -1) continue
        const kb = parseInt(line.substring(0, tabIdx), 10)
        const p = line.substring(tabIdx + 1)
        if (!isNaN(kb)) result.set(p, kb * 1024)
      }
    }
  }
  return result
}

// Windows fallback: 개별 폴더 재귀 탐색 (depth 제한)
async function getDirSizeRecursive(dirPath: string, maxDepth: number = 3, depth: number = 0): Promise<number> {
  let total = 0
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      try {
        if (entry.isSymbolicLink()) return 0
        if (entry.isFile()) {
          const stat = await fs.stat(fullPath)
          return stat.size
        }
        if (entry.isDirectory() && depth < maxDepth) {
          return getDirSizeRecursive(fullPath, maxDepth, depth + 1)
        }
      } catch {
        // skip
      }
      return 0
    })
    const sizes = await Promise.all(promises)
    total = sizes.reduce((a, b) => a + b, 0)
  } catch {
    // skip
  }
  return total
}

// macOS APFS 컨테이너 정보
async function getDiskInfo(): Promise<{ total: number; available: number; purgeable: number | null }> {
  if (platform() === 'darwin') {
    try {
      const { stdout } = await execFileAsync('diskutil', ['info', '-plist', '/'])
      const sizeMatch = stdout.match(/<key>APFSContainerSize<\/key>\s*<integer>(\d+)<\/integer>/)
      const freeMatch = stdout.match(/<key>APFSContainerFree<\/key>\s*<integer>(\d+)<\/integer>/)
      if (sizeMatch && freeMatch) {
        const total = parseInt(sizeMatch[1], 10)
        const free = parseInt(freeMatch[1], 10)
        return { total, available: free, purgeable: null }
      }
    } catch {
      // fallback
    }
  }

  try {
    const stats = await fs.statfs('/')
    const total = stats.blocks * stats.bsize
    const available = stats.bavail * stats.bsize
    return { total, available, purgeable: null }
  } catch {
    return { total: 0, available: 0, purgeable: null }
  }
}

export async function getUserSpaceInfo(): Promise<UserSpaceInfo> {
  const home = homedir()
  const folders = getHomeFolders()
  const diskInfo = await getDiskInfo()

  // 존재하는 폴더만 필터
  const existingFolders: { name: string; fullPath: string; icon: string }[] = []
  for (const folder of folders) {
    const fullPath = path.join(home, folder.rel)
    try {
      await fs.access(fullPath)
      existingFolders.push({ name: folder.name, fullPath, icon: folder.icon })
    } catch {
      // skip
    }
  }

  let entries: UserSpaceEntry[]

  if (platform() === 'darwin' || platform() === 'linux') {
    // 한 번의 du 호출로 모든 폴더 크기 측정
    const paths = existingFolders.map((f) => f.fullPath)
    const sizes = await getDirSizesBatchMac(paths)

    entries = existingFolders
      .map((f) => ({
        name: f.name,
        path: f.fullPath,
        size: sizes.get(f.fullPath) ?? 0,
        icon: f.icon
      }))
      .filter((e) => e.size > 0)
  } else {
    // Windows: 병렬 재귀 탐색
    const results = await Promise.all(
      existingFolders.map(async (f) => ({
        name: f.name,
        path: f.fullPath,
        size: await getDirSizeRecursive(f.fullPath),
        icon: f.icon
      }))
    )
    entries = results.filter((e) => e.size > 0)
  }

  entries.sort((a, b) => b.size - a.size)
  const homeSize = entries.reduce((acc, e) => acc + e.size, 0)

  return {
    homePath: home,
    homeSize,
    diskTotal: diskInfo.total,
    diskAvailable: diskInfo.available,
    diskUsage: diskInfo.total > 0
      ? Math.round(((diskInfo.total - diskInfo.available) / diskInfo.total) * 10000) / 100
      : 0,
    purgeable: diskInfo.purgeable,
    entries
  }
}
