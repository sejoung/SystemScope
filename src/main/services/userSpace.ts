import * as fs from 'fs/promises'
import * as path from 'path'
import { homedir, platform } from 'os'
import type { UserSpaceEntry, UserSpaceInfo } from '@shared/types'
import { logDebug, logWarn } from './logging'
import { getDirSizeRecursive } from '../utils/getDirSize'
import { isExternalCommandError, runExternalCommand } from './externalCommand'
let hasLoggedUserSpaceApfsFallback = false

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

// macOS/Linux: du -sk 명령으로 여러 폴더 크기를 한 번에 측정
async function getDirSizesBatchDu(paths: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  try {
    // du -sk path1 path2 path3... → 한 프로세스로 전부 측정
    const { stdout } = await runExternalCommand('du', ['-sk', ...paths], {
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
    // 권한 오류로 인해 stderr에 부분 결과가 있을 수 있음
    // du는 접근 가능한 경로의 크기는 여전히 출력함
    const stdout = isExternalCommandError(err) ? err.stdout : ''
    if (stdout) {
      for (const line of stdout.trim().split('\n')) {
        const tabIdx = line.indexOf('\t')
        if (tabIdx === -1) continue
        const kb = parseInt(line.substring(0, tabIdx), 10)
        const p = line.substring(tabIdx + 1)
        if (!isNaN(kb)) result.set(p, kb * 1024)
      }
    }

    if (isExternalCommandError(err) && err.kind === 'command_not_found') {
      logDebug('user-space', 'du is unavailable, falling back to recursive directory scans', { paths })
      const fallbackEntries = await Promise.all(paths.map(async (targetPath) => [targetPath, await getDirSizeRecursive(targetPath)] as const))
      for (const [targetPath, size] of fallbackEntries) {
        result.set(targetPath, size)
      }
      return result
    }

    if (!stdout) {
      logDebug('user-space', 'Failed to measure user-space folders in bulk with du', { paths, error: err })
    }
  }
  return result
}

// macOS APFS 컨테이너 정보
async function getDiskInfo(): Promise<{ total: number; available: number; purgeable: number | null }> {
  if (platform() === 'darwin') {
    try {
      const { stdout } = await runExternalCommand('diskutil', ['info', '-plist', '/'])
      const sizeMatch = stdout.match(/<key>APFSContainerSize<\/key>\s*<integer>(\d+)<\/integer>/)
      const freeMatch = stdout.match(/<key>APFSContainerFree<\/key>\s*<integer>(\d+)<\/integer>/)
      if (sizeMatch && freeMatch) {
        const total = parseInt(sizeMatch[1], 10)
        const free = parseInt(freeMatch[1], 10)
        return { total, available: free, purgeable: null }
      }
    } catch {
      if (!hasLoggedUserSpaceApfsFallback) {
        hasLoggedUserSpaceApfsFallback = true
        logDebug('user-space', 'Failed to read APFS container information, falling back to statfs')
      }
      // 대체 방식 사용
    }
  }

  try {
    const stats = await fs.statfs('/')
    const total = stats.blocks * stats.bsize
    const available = stats.bavail * stats.bsize
    return { total, available, purgeable: null }
  } catch {
    logWarn('user-space', 'Failed to determine filesystem capacity for user-space view')
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
      // 건너뜀
    }
  }

  let entries: UserSpaceEntry[]

  if (platform() === 'darwin' || platform() === 'linux') {
    // 한 번의 du 호출로 모든 폴더 크기 측정
    const paths = existingFolders.map((f) => f.fullPath)
    const sizes = await getDirSizesBatchDu(paths)

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
