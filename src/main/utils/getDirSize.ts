import * as fs from 'fs/promises'
import * as path from 'path'
import { platform } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logDebug } from '../services/logging'

const execFileAsync = promisify(execFile)

/** 플랫폼에 따라 최적의 방법으로 디렉토리 크기를 측정 */
export async function getDirSize(dirPath: string): Promise<number> {
  if (platform() === 'darwin' || platform() === 'linux') {
    return getDirSizeDu(dirPath)
  }
  return getDirSizeRecursive(dirPath, 4)
}

/** macOS/Linux: du -sk 명령어로 빠르게 디렉토리 크기 측정 */
async function getDirSizeDu(dirPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('du', ['-sk', dirPath], {
      timeout: 30000,
      env: { ...process.env, LANG: 'C' }
    })
    const kb = parseInt(stdout.split('\t')[0], 10)
    return isNaN(kb) ? 0 : kb * 1024
  } catch (err) {
    const errObj = err as { stdout?: string }
    if (errObj.stdout) {
      const kb = parseInt(errObj.stdout.split('\t')[0], 10)
      return isNaN(kb) ? 0 : kb * 1024
    }
    logDebug('dir-size', '디렉토리 크기 측정 실패 (du)', { dirPath, error: err })
    return 0
  }
}

/** 순수 JS 재귀로 디렉토리 크기 측정 (Windows 또는 depth 제어 필요 시) */
export async function getDirSizeRecursive(
  dirPath: string,
  maxDepth: number = 4,
  depth: number = 0
): Promise<number> {
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
        // 접근 불가 항목 건너뜀
      }
      return 0
    })
    const sizes = await Promise.all(promises)
    total = sizes.reduce((a, b) => a + b, 0)
  } catch {
    // 접근 불가 디렉토리 건너뜀
  }
  return total
}
