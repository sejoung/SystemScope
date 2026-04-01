import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { homedir } from 'node:os'
import type { ToolIntegrationResult, ReclaimableItem, ToolSummaryItem } from '@shared/types'
import { runExternalCommand, isExternalCommandError } from './externalCommand'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { logInfo, logDebug, logError } from './logging'
import { formatBytes } from '@shared/utils/formatBytes'

const BREW_PATHS = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']
const BREW_TIMEOUT = 30000

async function findBrewBinary(): Promise<string | null> {
  for (const brewPath of BREW_PATHS) {
    try {
      await fs.access(brewPath, fs.constants.X_OK)
      return brewPath
    } catch {
      // not found at this path
    }
  }
  return null
}

export async function scanHomebrew(): Promise<ToolIntegrationResult> {
  const brewBin = await findBrewBinary()
  if (!brewBin) {
    return {
      tool: 'homebrew', status: 'not_installed', message: 'Homebrew is not installed.',
      summary: [], reclaimable: [], lastScannedAt: Date.now()
    }
  }

  try {
    const [formulaeCount, caskCount, outdatedLines, cellarSize, cacheSize, cleanupItems] = await Promise.all([
      countFormulae(brewBin), countCasks(brewBin), getOutdatedPackages(brewBin),
      getCellarSize(brewBin), getCacheSize(), getCleanupDryRun(brewBin)
    ])

    const summary: ToolSummaryItem[] = [
      { key: 'formulae', label: 'Formulae', value: String(formulaeCount) },
      { key: 'casks', label: 'Casks', value: String(caskCount) },
      { key: 'outdated', label: 'Outdated', value: String(outdatedLines.length) },
      { key: 'cellarSize', label: 'Cellar Size', value: formatBytes(cellarSize) },
      { key: 'cacheSize', label: 'Cache Size', value: formatBytes(cacheSize) }
    ]

    const reclaimable: ReclaimableItem[] = [...cleanupItems, ...await getCacheReclaimable()]

    logInfo('homebrew-analyzer', 'Homebrew scan completed', {
      formulaeCount, caskCount, outdated: outdatedLines.length, reclaimableCount: reclaimable.length
    })

    return { tool: 'homebrew', status: 'ready', message: null, summary, reclaimable, lastScannedAt: Date.now() }
  } catch (err) {
    logError('homebrew-analyzer', 'Homebrew scan failed', { error: err })
    const message = isExternalCommandError(err) ? `Homebrew command failed: ${err.message}` : 'Failed to scan Homebrew.'
    return { tool: 'homebrew', status: 'error', message, summary: [], reclaimable: [], lastScannedAt: Date.now() }
  }
}

async function countFormulae(brewBin: string): Promise<number> {
  try {
    const { stdout } = await runExternalCommand(brewBin, ['list', '--formula', '-1'], { timeout: BREW_TIMEOUT })
    return stdout.trim().split('\n').filter(Boolean).length
  } catch { return 0 }
}

async function countCasks(brewBin: string): Promise<number> {
  try {
    const { stdout } = await runExternalCommand(brewBin, ['list', '--cask', '-1'], { timeout: BREW_TIMEOUT })
    return stdout.trim().split('\n').filter(Boolean).length
  } catch { return 0 }
}

async function getOutdatedPackages(brewBin: string): Promise<string[]> {
  try {
    const { stdout } = await runExternalCommand(brewBin, ['outdated', '--quiet'], { timeout: BREW_TIMEOUT })
    return stdout.trim().split('\n').filter(Boolean)
  } catch { return [] }
}

async function getCellarSize(brewBin: string): Promise<number> {
  try {
    const { stdout } = await runExternalCommand(brewBin, ['--cellar'], { timeout: BREW_TIMEOUT })
    const cellarPath = stdout.trim()
    if (!cellarPath) return 0
    return await getDirSizeEstimate(cellarPath, 4)
  } catch { return 0 }
}

async function getCacheSize(): Promise<number> {
  const cachePath = getBrewCachePath()
  try {
    await fs.access(cachePath)
    return await getDirSizeEstimate(cachePath, 4)
  } catch { return 0 }
}

function getBrewCachePath(): string {
  return path.join(homedir(), 'Library', 'Caches', 'Homebrew')
}

async function getCleanupDryRun(brewBin: string): Promise<ReclaimableItem[]> {
  try {
    const { stdout } = await runExternalCommand(brewBin, ['cleanup', '--dry-run'], { timeout: BREW_TIMEOUT })
    const lines = stdout.trim().split('\n').filter(Boolean)
    const items: ReclaimableItem[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('==>')) continue
      try {
        const stat = await fs.stat(trimmed)
        const size = stat.isDirectory() ? await getDirSizeEstimate(trimmed, 2) : stat.size
        const label = path.basename(path.dirname(trimmed)) + '/' + path.basename(trimmed)
        items.push({ id: `brew-cleanup-${items.length}`, tool: 'homebrew', path: trimmed, label, size, category: 'outdated_version', safetyLevel: 'safe' })
      } catch {
        logDebug('homebrew-analyzer', 'Skipping inaccessible cleanup item', { path: trimmed })
      }
    }
    return items
  } catch { return [] }
}

async function getCacheReclaimable(): Promise<ReclaimableItem[]> {
  const cachePath = getBrewCachePath()
  const items: ReclaimableItem[] = []
  try {
    const entries = await fs.readdir(cachePath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(cachePath, entry.name)
      try {
        const stat = await fs.stat(fullPath)
        const size = stat.isDirectory() ? await getDirSizeEstimate(fullPath, 2) : stat.size
        if (size < 1024 * 1024) continue
        items.push({ id: `brew-cache-${items.length}`, tool: 'homebrew', path: fullPath, label: `Cache: ${entry.name}`, size, category: 'cache', safetyLevel: 'safe' })
      } catch { /* skip */ }
    }
  } catch { /* cache dir not accessible */ }
  return items
}
