import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir, platform } from 'node:os'
import type { ToolIntegrationResult, ReclaimableItem, ToolSummaryItem } from '@shared/types'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { dirExists } from '../utils/fsHelpers'
import { logInfo, logDebug, logError } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

function getVSCodePaths(): { extensions: string; userData: string; cacheDir: string } {
  const home = homedir()
  const p = platform()

  if (p === 'darwin') {
    return {
      extensions: path.join(home, '.vscode', 'extensions'),
      userData: path.join(home, 'Library', 'Application Support', 'Code'),
      cacheDir: path.join(home, 'Library', 'Caches', 'com.microsoft.VSCode'),
    }
  }
  if (p === 'linux') {
    return {
      extensions: path.join(home, '.vscode', 'extensions'),
      userData: path.join(home, '.config', 'Code'),
      cacheDir: path.join(home, '.cache', 'Code'),
    }
  }
  // Windows
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
  return {
    extensions: path.join(home, '.vscode', 'extensions'),
    userData: path.join(appData, 'Code'),
    cacheDir: path.join(localAppData, 'Code', 'Cache'),
  }
}

export async function scanVSCode(): Promise<ToolIntegrationResult> {
  const paths = getVSCodePaths()
  const extensionsExist = await dirExists(paths.extensions)
  const userDataExists = await dirExists(paths.userData)

  if (!extensionsExist && !userDataExists) {
    return { tool: 'vscode', status: 'not_installed', message: 'VS Code is not installed.', summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }

  try {
    const [extensionResult, cacheResult] = await Promise.all([
      scanExtensions(paths.extensions),
      scanCache(paths.cacheDir),
    ])

    const summary: ToolSummaryItem[] = [
      { key: 'extensionCount', label: 'Extensions', value: String(extensionResult.count) },
      { key: 'extensionSize', label: 'Extensions Size', value: formatBytes(extensionResult.totalSize) },
      { key: 'cacheSize', label: 'Cache Size', value: formatBytes(cacheResult.totalSize) },
    ]

    const reclaimable: ReclaimableItem[] = [...extensionResult.reclaimable, ...cacheResult.reclaimable]

    logInfo('vscode-analyzer', 'VS Code scan completed', {
      extensionCount: extensionResult.count, extensionSize: extensionResult.totalSize,
      cacheSize: cacheResult.totalSize, reclaimableCount: reclaimable.length
    })

    return { tool: 'vscode', status: 'ready', message: null, summary, reclaimable, lastScannedAt: Date.now() }
  } catch (err) {
    logError('vscode-analyzer', 'VS Code scan failed', { error: err })
    return { tool: 'vscode', status: 'error', message: 'Failed to scan VS Code.', summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }
}

async function scanExtensions(extensionsPath: string): Promise<{ count: number; totalSize: number; reclaimable: ReclaimableItem[] }> {
  const reclaimable: ReclaimableItem[] = []
  let totalSize = 0
  let count = 0

  try {
    const entries = await fs.readdir(extensionsPath, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    count = dirs.length

    // Detect duplicate versions: group by extension name (without version)
    const byName = new Map<string, { name: string; version: string; fullPath: string; size: number }[]>()

    for (const dir of dirs) {
      const fullPath = path.join(extensionsPath, dir.name)
      try {
        const size = await getDirSizeEstimate(fullPath, 3)
        totalSize += size

        // Extension dirs are like "publisher.name-1.2.3"
        const match = dir.name.match(/^(.+)-(\d+\.\d+\.\d+.*)$/)
        const extName = match ? match[1] : dir.name
        const version = match ? match[2] : ''

        const group = byName.get(extName) ?? []
        group.push({ name: dir.name, version, fullPath, size })
        byName.set(extName, group)
      } catch {
        logDebug('vscode-analyzer', 'Skipping inaccessible extension', { path: fullPath })
      }
    }

    // Mark old versions as reclaimable
    for (const [, versions] of byName) {
      if (versions.length <= 1) continue
      // Sort by version descending, mark all but latest as reclaimable
      versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
      for (let i = 1; i < versions.length; i++) {
        reclaimable.push({
          id: `vscode-ext-${reclaimable.length}`,
          tool: 'vscode',
          path: versions[i].fullPath,
          label: `Old Extension: ${versions[i].name}`,
          size: versions[i].size,
          category: 'old_extension',
          safetyLevel: 'safe'
        })
      }
    }
  } catch { /* extensions dir not accessible */ }

  return { count, totalSize, reclaimable }
}

async function scanCache(cachePath: string): Promise<{ totalSize: number; reclaimable: ReclaimableItem[] }> {
  const reclaimable: ReclaimableItem[] = []
  let totalSize = 0

  try {
    if (!(await dirExists(cachePath))) return { totalSize: 0, reclaimable: [] }

    totalSize = await getDirSizeEstimate(cachePath, 3)

    if (totalSize > 50 * 1024 * 1024) { // Only suggest if > 50MB
      reclaimable.push({
        id: 'vscode-cache-0',
        tool: 'vscode',
        path: cachePath,
        label: 'VS Code Cache',
        size: totalSize,
        category: 'cache',
        safetyLevel: 'safe'
      })
    }
  } catch { /* cache not accessible */ }

  return { totalSize, reclaimable }
}
