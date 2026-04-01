import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform } from 'node:os'
import type { ToolIntegrationResult, ReclaimableItem, ToolSummaryItem } from '@shared/types'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { logInfo } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

interface ToolchainTarget {
  id: string
  label: string
  category: string
  macPaths: string[]
  winPaths: string[]
  safetyLevel: 'safe' | 'caution' | 'risky'
  minSizeBytes: number // Only list if larger than this
}

function getTargets(home: string): ToolchainTarget[] {
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')

  return [
    // Node.js
    { id: 'npm_cache', label: 'npm Cache', category: 'node', macPaths: [path.join(home, '.npm', '_cacache')], winPaths: [path.join(appData, 'npm-cache'), path.join(home, '.npm', '_cacache')], safetyLevel: 'safe', minSizeBytes: 10 * 1024 * 1024 },
    { id: 'yarn_cache', label: 'Yarn Cache', category: 'node', macPaths: [path.join(home, 'Library', 'Caches', 'Yarn')], winPaths: [path.join(localAppData, 'Yarn', 'Cache')], safetyLevel: 'safe', minSizeBytes: 10 * 1024 * 1024 },
    { id: 'pnpm_store', label: 'pnpm Store', category: 'node', macPaths: [path.join(home, 'Library', 'pnpm', 'store'), path.join(home, '.local', 'share', 'pnpm', 'store')], winPaths: [path.join(localAppData, 'pnpm-store')], safetyLevel: 'caution', minSizeBytes: 50 * 1024 * 1024 },

    // Python
    { id: 'pip_cache', label: 'pip Cache', category: 'python', macPaths: [path.join(home, 'Library', 'Caches', 'pip')], winPaths: [path.join(localAppData, 'pip', 'Cache')], safetyLevel: 'safe', minSizeBytes: 10 * 1024 * 1024 },

    // Rust
    { id: 'cargo_registry', label: 'Cargo Registry', category: 'rust', macPaths: [path.join(home, '.cargo', 'registry')], winPaths: [path.join(home, '.cargo', 'registry')], safetyLevel: 'caution', minSizeBytes: 50 * 1024 * 1024 },
    { id: 'rustup_toolchains', label: 'Rustup Toolchains', category: 'rust', macPaths: [path.join(home, '.rustup', 'toolchains')], winPaths: [path.join(home, '.rustup', 'toolchains')], safetyLevel: 'risky', minSizeBytes: 100 * 1024 * 1024 },

    // Java/JVM
    { id: 'maven_repo', label: 'Maven Repository', category: 'jvm', macPaths: [path.join(home, '.m2', 'repository')], winPaths: [path.join(home, '.m2', 'repository')], safetyLevel: 'caution', minSizeBytes: 50 * 1024 * 1024 },
    { id: 'gradle_cache', label: 'Gradle Cache', category: 'jvm', macPaths: [path.join(home, '.gradle', 'caches')], winPaths: [path.join(home, '.gradle', 'caches')], safetyLevel: 'safe', minSizeBytes: 50 * 1024 * 1024 },

    // Go
    { id: 'go_mod_cache', label: 'Go Module Cache', category: 'go', macPaths: [path.join(home, 'go', 'pkg', 'mod')], winPaths: [path.join(home, 'go', 'pkg', 'mod')], safetyLevel: 'safe', minSizeBytes: 50 * 1024 * 1024 },
  ]
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch { return false }
}

export async function scanToolchain(): Promise<ToolIntegrationResult> {
  const home = homedir()
  const isMac = platform() === 'darwin'
  const targets = getTargets(home)

  const scanned: { target: ToolchainTarget; path: string; size: number }[] = []

  await Promise.all(targets.map(async (target) => {
    const candidates = isMac ? target.macPaths : target.winPaths
    for (const candidatePath of candidates) {
      if (await dirExists(candidatePath)) {
        try {
          const size = await getDirSizeEstimate(candidatePath, 3)
          scanned.push({ target, path: candidatePath, size })
        } catch { /* skip */ }
        break // Use first found path
      }
    }
  }))

  if (scanned.length === 0) {
    return { tool: 'toolchain', status: 'not_installed', message: 'No developer toolchain caches found.', summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }

  const totalSize = scanned.reduce((sum, s) => sum + s.size, 0)

  // Group by category for summary
  const byCategory = new Map<string, number>()
  for (const s of scanned) {
    byCategory.set(s.target.category, (byCategory.get(s.target.category) ?? 0) + s.size)
  }

  const summary: ToolSummaryItem[] = [
    { key: 'totalToolchains', label: 'Toolchains Found', value: String(scanned.length) },
    { key: 'totalSize', label: 'Total Size', value: formatBytes(totalSize) },
    ...Array.from(byCategory.entries()).map(([cat, size]) => ({
      key: `cat_${cat}`, label: cat.charAt(0).toUpperCase() + cat.slice(1), value: formatBytes(size)
    }))
  ]

  const reclaimable: ReclaimableItem[] = scanned
    .filter((s) => s.size >= s.target.minSizeBytes)
    .map((s, i) => ({
      id: `toolchain-${i}`,
      tool: 'toolchain' as const,
      path: s.path,
      label: s.target.label,
      size: s.size,
      category: s.target.category,
      safetyLevel: s.target.safetyLevel
    }))

  logInfo('toolchain-analyzer', 'Toolchain scan completed', {
    found: scanned.length, totalSize, reclaimableCount: reclaimable.length
  })

  return { tool: 'toolchain', status: 'ready', message: null, summary, reclaimable, lastScannedAt: Date.now() }
}
