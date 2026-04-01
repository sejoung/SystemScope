import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, tmpdir, platform } from 'node:os'
import * as fsSync from 'node:fs'
import type { ScanCategory, QuickScanFolder } from '@shared/types'
import { getDirSizeEstimate, getDirSizeRecursive } from '../utils/getDirSize'
import { isExternalCommandError, runExternalCommand } from './externalCommand'
import { logDebug } from './logging'

interface ScanTarget {
  name: string
  description: string
  cleanable: boolean
  category: ScanCategory
  paths: string[] // 후보 경로 목록 — 첫 번째로 존재하는 경로 사용
}

function getMacTargets(home: string): ScanTarget[] {
  // Homebrew: Apple Silicon = /opt/homebrew, Intel = /usr/local
  const brewPrefix = fsSync.existsSync('/opt/homebrew') ? '/opt/homebrew' : '/usr/local'

  return [
    // --- 시스템 / 일반 ---
    { name: 'Caches', description: '앱 캐시 파일', cleanable: true, category: 'system', paths: [path.join(home, 'Library/Caches')] },
    { name: 'Logs', description: '시스템 및 앱 로그', cleanable: true, category: 'system', paths: [path.join(home, 'Library/Logs')] },
    { name: 'Downloads', description: '다운로드 폴더', cleanable: true, category: 'system', paths: [path.join(home, 'Downloads')] },
    { name: 'Trash', description: '휴지통', cleanable: true, category: 'system', paths: [path.join(home, '.Trash')] },
    { name: 'Application Support', description: '앱 데이터', cleanable: false, category: 'system', paths: [path.join(home, 'Library/Application Support')] },
    { name: 'Containers', description: '샌드박스 앱 데이터', cleanable: false, category: 'system', paths: [path.join(home, 'Library/Containers')] },

    // --- Homebrew ---
    { name: 'Homebrew Cellar', description: '설치된 패키지 (brew cleanup으로 이전 버전 정리)', cleanable: true, category: 'homebrew', paths: [path.join(brewPrefix, 'Cellar')] },
    { name: 'Homebrew Caskroom', description: '설치된 Cask 앱', cleanable: false, category: 'homebrew', paths: [path.join(brewPrefix, 'Caskroom')] },
    { name: 'Homebrew Cache', description: '다운로드된 bottle/소스 캐시', cleanable: true, category: 'homebrew', paths: [path.join(home, 'Library/Caches/Homebrew')] },
    { name: 'Homebrew Logs', description: 'Homebrew 빌드 로그', cleanable: true, category: 'homebrew', paths: [path.join(home, 'Library/Logs/Homebrew')] },
    { name: 'Homebrew Temp', description: 'Homebrew 빌드 임시 파일', cleanable: true, category: 'homebrew', paths: [path.join(brewPrefix, 'tmp')] },

    // --- 개발 도구 ---
    { name: 'Xcode DerivedData', description: 'Xcode 빌드 캐시', cleanable: true, category: 'devtools', paths: [path.join(home, 'Library/Developer/Xcode/DerivedData')] },
    { name: 'Xcode Archives', description: 'Xcode 아카이브', cleanable: true, category: 'devtools', paths: [path.join(home, 'Library/Developer/Xcode/Archives')] },
    { name: 'CoreSimulator', description: 'iOS 시뮬레이터 디바이스', cleanable: true, category: 'devtools', paths: [path.join(home, 'Library/Developer/CoreSimulator/Devices')] },
    { name: 'Android SDK', description: 'Android SDK / AVD', cleanable: false, category: 'devtools', paths: [path.join(home, 'Library/Android/sdk')] },

    // --- 패키지 매니저 ---
    { name: 'npm cache', description: 'npm 패키지 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.npm/_cacache')] },
    { name: 'yarn cache', description: 'Yarn 패키지 캐시', cleanable: true, category: 'packages', paths: [path.join(home, 'Library/Caches/Yarn')] },
    { name: 'pnpm store', description: 'pnpm 패키지 스토어', cleanable: true, category: 'packages', paths: [path.join(home, 'Library/pnpm/store'), path.join(home, '.local/share/pnpm/store')] },
    { name: 'pip cache', description: 'Python pip 캐시', cleanable: true, category: 'packages', paths: [path.join(home, 'Library/Caches/pip')] },
    { name: 'Cargo registry', description: 'Rust Cargo 레지스트리 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.cargo/registry')] },
    { name: 'Go modules', description: 'Go 모듈 캐시', cleanable: true, category: 'packages', paths: [path.join(home, 'go/pkg/mod')] },
    { name: 'Maven', description: 'Maven 로컬 저장소', cleanable: true, category: 'packages', paths: [path.join(home, '.m2/repository')] },
    { name: 'Gradle', description: 'Gradle 빌드 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.gradle')] },
    { name: 'CocoaPods', description: 'CocoaPods 캐시', cleanable: true, category: 'packages', paths: [path.join(home, 'Library/Caches/CocoaPods')] },
    { name: 'Composer', description: 'PHP Composer 캐시', cleanable: true, category: 'packages', paths: [path.join(home, 'Library/Caches/composer')] },

    // --- 컨테이너 / VM ---
    { name: 'Docker', description: 'Docker 이미지 및 컨테이너 데이터', cleanable: false, category: 'containers', paths: [path.join(home, 'Library/Containers/com.docker.docker/Data')] },
    { name: 'Orbstack', description: 'Orbstack 데이터', cleanable: false, category: 'containers', paths: [path.join(home, 'Library/Group Containers/group.dev.kdrag0n.orbstack')] },

    // --- 브라우저 ---
    { name: 'Chrome Cache', description: 'Chrome 브라우저 캐시', cleanable: true, category: 'browsers', paths: [path.join(home, 'Library/Caches/Google/Chrome')] },
    { name: 'Safari Cache', description: 'Safari 브라우저 캐시', cleanable: true, category: 'browsers', paths: [path.join(home, 'Library/Caches/com.apple.Safari')] },
  ]
}

function getWindowsTargets(home: string): ScanTarget[] {
  const appData = process.env.APPDATA || path.join(home, 'AppData/Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local')
  const temp = tmpdir()

  return [
    // --- 시스템 ---
    { name: 'Temp', description: '임시 파일', cleanable: true, category: 'system', paths: [temp, path.join(localAppData, 'Temp')] },
    { name: 'Downloads', description: '다운로드 폴더', cleanable: true, category: 'system', paths: [path.join(home, 'Downloads')] },
    { name: 'Recycle Bin', description: '휴지통', cleanable: true, category: 'system', paths: [`${process.env.SystemDrive || 'C:'}\\$Recycle.Bin`] },
    { name: 'Windows Update', description: 'Windows 업데이트 캐시', cleanable: true, category: 'system', paths: [`${process.env.SystemDrive || 'C:'}\\Windows\\SoftwareDistribution\\Download`] },
    { name: 'Crash Dumps', description: '크래시 덤프', cleanable: true, category: 'system', paths: [path.join(localAppData, 'CrashDumps')] },

    // --- 브라우저 ---
    { name: 'Chrome Cache', description: 'Chrome 브라우저 캐시', cleanable: true, category: 'browsers', paths: [path.join(localAppData, 'Google/Chrome/User Data/Default/Cache')] },
    { name: 'Edge Cache', description: 'Edge 브라우저 캐시', cleanable: true, category: 'browsers', paths: [path.join(localAppData, 'Microsoft/Edge/User Data/Default/Cache')] },

    // --- 패키지 매니저 ---
    { name: 'npm cache', description: 'npm 패키지 캐시', cleanable: true, category: 'packages', paths: [path.join(appData, 'npm-cache'), path.join(home, '.npm/_cacache')] },
    { name: 'yarn cache', description: 'Yarn 패키지 캐시', cleanable: true, category: 'packages', paths: [path.join(localAppData, 'Yarn/Cache')] },
    { name: 'pnpm store', description: 'pnpm 패키지 스토어', cleanable: true, category: 'packages', paths: [path.join(localAppData, 'pnpm-store')] },
    { name: 'pip cache', description: 'Python pip 캐시', cleanable: true, category: 'packages', paths: [path.join(localAppData, 'pip/Cache')] },
    { name: 'NuGet cache', description: 'NuGet 패키지 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.nuget/packages')] },
    { name: 'Cargo registry', description: 'Rust Cargo 레지스트리 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.cargo/registry')] },
    { name: 'Maven', description: 'Maven 로컬 저장소', cleanable: true, category: 'packages', paths: [path.join(home, '.m2/repository')] },
    { name: 'Gradle', description: 'Gradle 빌드 캐시', cleanable: true, category: 'packages', paths: [path.join(home, '.gradle')] },
    // --- 컨테이너 ---
    { name: 'Docker', description: 'Docker 데이터', cleanable: false, category: 'containers', paths: [path.join(localAppData, 'Docker')] },

    // --- 개발 도구 ---
    { name: 'VS Code Extensions', description: 'VS Code 확장', cleanable: false, category: 'devtools', paths: [path.join(home, '.vscode/extensions')] },
    { name: 'AppData Local', description: '로컬 앱 데이터', cleanable: false, category: 'system', paths: [localAppData] }
  ]
}

const SCAN_BATCH_SIZE = 8
const QUICK_SCAN_CACHE_TTL_MS = 5 * 60 * 1000

let quickScanCache: { key: string; timestamp: number; results: QuickScanFolder[] } | null = null

export async function runQuickScan(
  onProgress?: (name: string, index: number, total: number) => void
): Promise<QuickScanFolder[]> {
  const home = homedir()
  const isMacOrLinux = platform() === 'darwin' || platform() === 'linux'
  const targets = platform() === 'darwin' ? getMacTargets(home) : getWindowsTargets(home)
  const cacheKey = `${platform()}:${home}`

  if (quickScanCache && quickScanCache.key === cacheKey && Date.now() - quickScanCache.timestamp < QUICK_SCAN_CACHE_TTL_MS) {
    return quickScanCache.results
  }

  const resolvedTargets = await resolveQuickScanTargets(targets, onProgress)
  let results: QuickScanFolder[]

  if (isMacOrLinux) {
    results = await buildQuickScanResultsWithBatchDu(resolvedTargets)
  } else {
    results = await buildQuickScanResultsWithRecursiveScan(resolvedTargets)
  }

  results = results.sort((a, b) => b.size - a.size)
  quickScanCache = {
    key: cacheKey,
    timestamp: Date.now(),
    results
  }
  return results
}

interface ResolvedQuickScanTarget extends Omit<ScanTarget, 'paths'> {
  path: string
}

async function resolveQuickScanTargets(
  targets: ScanTarget[],
  onProgress?: (name: string, index: number, total: number) => void
): Promise<ResolvedQuickScanTarget[]> {
  const resolvedTargets: ResolvedQuickScanTarget[] = []

  for (let i = 0; i < targets.length; i += SCAN_BATCH_SIZE) {
    const batch = targets.slice(i, i + SCAN_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (target, batchIdx) => {
        onProgress?.(target.name, i + batchIdx, targets.length)

        for (const candidatePath of target.paths) {
          try {
            await fs.access(candidatePath)
            return {
              name: target.name,
              path: candidatePath,
              description: target.description,
              cleanable: target.cleanable,
              category: target.category
            } satisfies ResolvedQuickScanTarget
          } catch {
            // try next candidate
          }
        }

        return null
      })
    )

    for (const result of batchResults) {
      if (result) {
        resolvedTargets.push(result)
      }
    }
  }

  return resolvedTargets
}

async function buildQuickScanResultsWithBatchDu(
  targets: ResolvedQuickScanTarget[]
): Promise<QuickScanFolder[]> {
  const sizes = await getDirSizesBatchDu(targets.map((target) => target.path))

  return targets
    .map((target) => ({
      name: target.name,
      path: target.path,
      description: target.description,
      size: sizes.get(target.path) ?? 0,
      exists: true,
      cleanable: target.cleanable,
      category: target.category
    }) satisfies QuickScanFolder)
    .filter((target) => target.size > 0)
}

async function buildQuickScanResultsWithRecursiveScan(
  targets: ResolvedQuickScanTarget[]
): Promise<QuickScanFolder[]> {
  const results: QuickScanFolder[] = []

  for (let i = 0; i < targets.length; i += SCAN_BATCH_SIZE) {
    const batch = targets.slice(i, i + SCAN_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (target) => ({
        name: target.name,
        path: target.path,
        description: target.description,
        size: await getDirSizeRecursive(target.path, 2),
        exists: true,
        cleanable: target.cleanable,
        category: target.category
      }) satisfies QuickScanFolder)
    )

    for (const result of batchResults) {
      if (result.size > 0) {
        results.push(result)
      }
    }
  }

  return results
}

async function getDirSizesBatchDu(paths: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (paths.length === 0) {
    return result
  }

  try {
    const { stdout } = await runExternalCommand('du', ['-sk', '--', ...paths], {
      timeout: 60_000,
      env: { ...process.env, LANG: 'C' },
      maxBuffer: 1024 * 1024
    })
    consumeDuOutput(stdout, result)
    return result
  } catch (err) {
    const stdout = isExternalCommandError(err) ? err.stdout : ''
    if (stdout) {
      consumeDuOutput(stdout, result)
    }

    if (isExternalCommandError(err) && err.kind === 'command_not_found') {
      logDebug('quick-scan', 'du is unavailable, falling back to per-path directory scans', { pathCount: paths.length })
    } else if (!stdout) {
      logDebug('quick-scan', 'Bulk quick-scan du failed, falling back to per-path directory scans', {
        pathCount: paths.length,
        error: err
      })
    }
  }

  const fallbackResults = await Promise.all(
    paths.map(async (targetPath) => [targetPath, await getDirSizeEstimate(targetPath, 4)] as const)
  )
  for (const [targetPath, size] of fallbackResults) {
    result.set(targetPath, size)
  }
  return result
}

function consumeDuOutput(stdout: string, result: Map<string, number>): void {
  for (const line of stdout.trim().split('\n')) {
    const tabIndex = line.indexOf('\t')
    if (tabIndex === -1) continue
    const kb = Number.parseInt(line.slice(0, tabIndex), 10)
    const targetPath = line.slice(tabIndex + 1)
    if (!Number.isNaN(kb)) {
      result.set(targetPath, kb * 1024)
    }
  }
}
