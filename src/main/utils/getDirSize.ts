import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { platform } from 'node:os'
import { isExternalCommandError, runExternalCommand } from '@main/services/core/externalCommand'
import { logDebug } from '@main/services/core/logging'
import { createConcurrencyLimiter, runWithConcurrency } from '@main/services/core/runWithConcurrency'

const DIRECTORY_IO_CONCURRENCY = 16
const directoryIoLimit = createConcurrencyLimiter(DIRECTORY_IO_CONCURRENCY)

/** 플랫폼에 따라 최적의 방법으로 디렉토리 크기를 측정 */
export async function getDirSize(dirPath: string): Promise<number> {
  if (platform() === 'darwin' || platform() === 'linux') {
    return getDirSizeDu(dirPath)
  }
  return getDirSizeRecursive(dirPath)
}

/** 빠른 추정이 필요할 때 사용하는 depth-limited 디렉토리 크기 측정 */
export async function getDirSizeEstimate(
  dirPath: string,
  maxDepth: number = 4
): Promise<number> {
  return getDirSizeRecursive(dirPath, maxDepth)
}

/** macOS/Linux: du -sk 명령어로 빠르게 디렉토리 크기 측정 */
async function getDirSizeDu(dirPath: string): Promise<number> {
  try {
    const { stdout } = await runExternalCommand('du', ['-sk', '--', dirPath], {
      timeout: 30000,
      env: { ...process.env, LANG: 'C' }
    })
    const kb = parseInt(stdout.split('\t')[0], 10)
    return isNaN(kb) ? 0 : kb * 1024
  } catch (err) {
    const stdout = isExternalCommandError(err) ? err.stdout : ''
    if (stdout) {
      const kb = parseInt(stdout.split('\t')[0], 10)
      return isNaN(kb) ? 0 : kb * 1024
    }
    if (isExternalCommandError(err) && err.kind === 'command_not_found') {
      logDebug('dir-size', 'du is unavailable, falling back to recursive directory scan', { dirPath })
      return getDirSizeRecursive(dirPath)
    }
    logDebug('dir-size', 'Failed to measure directory size with du', { dirPath, error: err })
    return getDirSizeRecursive(dirPath)
  }
}

/** 순수 JS 재귀로 디렉토리 크기 측정 (Windows 또는 depth 제어 필요 시) */
export async function getDirSizeRecursive(
  dirPath: string,
  maxDepth: number = Number.POSITIVE_INFINITY,
  depth: number = 0
): Promise<number> {
  let total = 0
  try {
    const entries = await directoryIoLimit(() => fs.readdir(dirPath, { withFileTypes: true }))
    const sizes = new Array<number>(entries.length).fill(0)
    await runWithConcurrency(entries.map((entry, index) => ({ entry, index })), DIRECTORY_IO_CONCURRENCY, async ({ entry, index }) => {
      const fullPath = path.join(dirPath, entry.name)
      try {
        if (entry.isSymbolicLink()) return
        if (entry.isFile()) {
          const stat = await directoryIoLimit(() => fs.stat(fullPath))
          sizes[index] = stat.size
          return
        }
        if (entry.isDirectory() && depth < maxDepth) {
          sizes[index] = await getDirSizeRecursive(fullPath, maxDepth, depth + 1)
        }
      } catch {
        // 접근 불가 항목 건너뜀
      }
    })
    total = sizes.reduce((a, b) => a + b, 0)
  } catch {
    // 접근 불가 디렉토리 건너뜀
  }
  return total
}
