import * as fs from 'fs/promises'
import * as path from 'path'
import { homedir, tmpdir, platform } from 'os'
import * as fsSync from 'fs'
import type { ScanCategory, QuickScanFolder } from '@shared/types'
import { getDirSize, getDirSizeRecursive } from '../utils/getDirSize'

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
    { name: 'Recycle Bin', description: '휴지통', cleanable: true, category: 'system', paths: ['C:\\$Recycle.Bin'] },
    { name: 'Windows Update', description: 'Windows 업데이트 캐시', cleanable: true, category: 'system', paths: ['C:\\Windows\\SoftwareDistribution\\Download'] },
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

export async function runQuickScan(
  onProgress?: (name: string, index: number, total: number) => void
): Promise<QuickScanFolder[]> {
  const home = homedir()
  const isMacOrLinux = platform() === 'darwin' || platform() === 'linux'
  const targets = platform() === 'darwin' ? getMacTargets(home) : getWindowsTargets(home)
  const results: QuickScanFolder[] = []

  // 배치 단위로 병렬 처리
  for (let i = 0; i < targets.length; i += SCAN_BATCH_SIZE) {
    const batch = targets.slice(i, i + SCAN_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (target, batchIdx) => {
        onProgress?.(target.name, i + batchIdx, targets.length)

        // 후보 경로 중 첫 번째로 존재하는 경로 사용
        let foundPath: string | null = null
        for (const p of target.paths) {
          try {
            await fs.access(p)
            foundPath = p
            break
          } catch {
            // 다음 경로 시도
          }
        }

        if (!foundPath) return null

        // macOS/Linux: du -sk로 빠르게 측정, Windows: 재귀 탐색
        const size = isMacOrLinux
          ? await getDirSize(foundPath)
          : await getDirSizeRecursive(foundPath, 2)
        return {
          name: target.name,
          path: foundPath,
          description: target.description,
          size,
          exists: true,
          cleanable: target.cleanable,
          category: target.category
        } satisfies QuickScanFolder
      })
    )

    for (const result of batchResults) {
      if (result) results.push(result)
    }
  }

  return results.sort((a, b) => b.size - a.size)
}
