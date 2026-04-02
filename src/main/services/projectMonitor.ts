import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type { ProjectMonitorSummary, ProjectMonitorWorkspace, ProjectMonitorCategoryStat } from '@shared/types'
import { PersistentStore } from './persistentStore'
import { getProjectMonitorFilePath } from './dataDir'
import { getActiveProfile } from './profileManager'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { logInfo, logWarn } from './logging'
import { registerShellPaths } from './shellPathRegistry'
import { recordEvent } from './eventStore'

interface ProjectMonitorEntry {
  path: string
  size: number
  scannedAt: number
  categories: ProjectMonitorCategoryStat[]
}

const PROJECT_MONITOR_SCHEMA_VERSION = 1
const PROJECT_MONITOR_MAX_ENTRIES = 2000
const PROJECT_MONITOR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const PROJECT_MONITOR_REFRESH_MS = 30 * 60 * 1000
const PROJECT_MONITOR_STALE_MS = 60 * 60 * 1000
const PROJECT_MONITOR_GROWTH_ALERT_BYTES = 1024 * 1024 * 1024

let projectMonitorStore: PersistentStore<ProjectMonitorEntry> | null = null
let projectMonitorTimer: ReturnType<typeof setInterval> | null = null

function getStore(): PersistentStore<ProjectMonitorEntry> {
  if (!projectMonitorStore) {
    projectMonitorStore = new PersistentStore<ProjectMonitorEntry>({
      filePath: getProjectMonitorFilePath(),
      schemaVersion: PROJECT_MONITOR_SCHEMA_VERSION,
      maxEntries: PROJECT_MONITOR_MAX_ENTRIES,
      maxAgeMs: PROJECT_MONITOR_MAX_AGE_MS,
      getTimestamp: (entry) => entry.scannedAt
    })
  }
  return projectMonitorStore
}

export async function getProjectMonitorSummary(): Promise<ProjectMonitorSummary> {
  const entries = await getStore().load()
  const activeProfile = getActiveProfile()
  const workspacePaths = activeProfile?.workspacePaths ?? []
  if (workspacePaths.length === 0) {
    return {
      workspaces: [],
      totalSize: 0,
      totalRecentGrowthBytes: 0,
      scannedAt: Date.now()
    }
  }

  registerShellPaths(workspacePaths, 'descendant')
  const nextWorkspaces = await Promise.all(
    workspacePaths.map(async (workspacePath) => summarizeWorkspace(workspacePath, entries))
  )

  const stalePaths = nextWorkspaces
    .filter((workspace) => workspace.exists && (!workspace.lastScannedAt || Date.now() - workspace.lastScannedAt > PROJECT_MONITOR_STALE_MS))
    .map((workspace) => workspace.path)

  if (stalePaths.length > 0) {
    await refreshProjectMonitor(stalePaths)
    return getProjectMonitorSummary()
  }

  return {
    workspaces: nextWorkspaces,
    totalSize: nextWorkspaces.reduce((sum, workspace) => sum + workspace.currentSize, 0),
    totalRecentGrowthBytes: nextWorkspaces.reduce((sum, workspace) => sum + workspace.recentGrowthBytes, 0),
    scannedAt: Date.now()
  }
}

export async function refreshProjectMonitor(pathsOverride?: string[]): Promise<void> {
  const activeProfile = getActiveProfile()
  const workspacePaths = pathsOverride ?? activeProfile?.workspacePaths ?? []
  if (workspacePaths.length === 0) {
    return
  }

  const uniquePaths = Array.from(new Set(workspacePaths.map((workspacePath) => path.resolve(workspacePath))))
  const entries = await Promise.all(uniquePaths.map(scanWorkspace))
  await getStore().appendBatch(entries)
  registerShellPaths(uniquePaths, 'descendant')
  await emitWorkspaceGrowthEvents(entries)
  logInfo('project-monitor', 'Project workspaces scanned', { count: entries.length })
}

export function initProjectMonitor(): void {
  if (projectMonitorTimer) {
    clearInterval(projectMonitorTimer)
  }

  void refreshProjectMonitor().catch((error) => {
    logWarn('project-monitor', 'Initial project monitoring scan failed', { error })
  })

  projectMonitorTimer = setInterval(() => {
    void refreshProjectMonitor().catch((error) => {
      logWarn('project-monitor', 'Scheduled project monitoring scan failed', { error })
    })
  }, PROJECT_MONITOR_REFRESH_MS)
}

export function stopProjectMonitor(): void {
  if (projectMonitorTimer) {
    clearInterval(projectMonitorTimer)
    projectMonitorTimer = null
  }
}

async function summarizeWorkspace(workspacePath: string, entries: ProjectMonitorEntry[]): Promise<ProjectMonitorWorkspace> {
  const resolvedPath = path.resolve(workspacePath)
  const workspaceEntries = entries
    .filter((entry) => path.resolve(entry.path) === resolvedPath)
    .sort((left, right) => right.scannedAt - left.scannedAt)

  const latest = workspaceEntries[0] ?? null
  const previous = workspaceEntries[1] ?? null
  const exists = await pathExists(resolvedPath)

  return {
    path: resolvedPath,
    name: path.basename(resolvedPath) || resolvedPath,
    exists,
    currentSize: latest?.size ?? 0,
    previousSize: previous?.size ?? null,
    recentGrowthBytes: latest && previous ? Math.max(0, latest.size - previous.size) : 0,
    lastScannedAt: latest?.scannedAt ?? null,
    topCategories: latest?.categories ?? [],
    history: workspaceEntries
      .slice(0, 5)
      .map((entry) => ({ scannedAt: entry.scannedAt, size: entry.size }))
      .reverse()
  }
}

async function scanWorkspace(workspacePath: string): Promise<ProjectMonitorEntry> {
  const resolvedPath = path.resolve(workspacePath)
  let size = 0

  try {
    await fs.access(resolvedPath)
    size = await getDirSizeEstimate(resolvedPath, 3)
  } catch (error) {
    logWarn('project-monitor', 'Workspace scan skipped', { path: resolvedPath, error })
  }

  return {
    path: resolvedPath,
    size,
    scannedAt: Date.now(),
    categories: await scanWorkspaceCategories(resolvedPath)
  }
}

async function scanWorkspaceCategories(workspacePath: string): Promise<ProjectMonitorCategoryStat[]> {
  const buckets: Array<{ category: ProjectMonitorCategoryStat['category']; label: string; candidates: string[] }> = [
    { category: 'dependencies', label: 'Dependencies', candidates: ['node_modules', 'vendor', '.venv'] },
    { category: 'build_outputs', label: 'Build Outputs', candidates: ['dist', 'build', '.next', '.nuxt', 'out'] },
    { category: 'caches', label: 'Caches', candidates: ['.cache', '.turbo', '.gradle', '.parcel-cache'] },
    { category: 'artifacts', label: 'Artifacts', candidates: ['coverage', 'DerivedData', '.idea', '.vscode'] }
  ]

  const stats = await Promise.all(buckets.map(async (bucket) => {
    let size = 0
    for (const candidate of bucket.candidates) {
      size += await getDirSizeEstimate(path.join(workspacePath, candidate), 2)
    }
    const stat: ProjectMonitorCategoryStat = {
      category: bucket.category,
      label: bucket.label,
      size
    }
    return stat
  }))

  const knownSize = stats.reduce((sum, stat) => sum + stat.size, 0)
  const totalSize = await getDirSizeEstimate(workspacePath, 2)
  const otherSize = Math.max(0, totalSize - knownSize)
  const otherStat: ProjectMonitorCategoryStat = { category: 'other', label: 'Other', size: otherSize }
  return [...stats, otherStat]
    .filter((stat) => stat.size > 0)
    .sort((left, right) => right.size - left.size)
    .slice(0, 4)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function emitWorkspaceGrowthEvents(entries: ProjectMonitorEntry[]): Promise<void> {
  const historicalEntries = await getStore().load()
  for (const entry of entries) {
    const previous = historicalEntries
      .filter((item) => path.resolve(item.path) === path.resolve(entry.path) && item.scannedAt < entry.scannedAt)
      .sort((left, right) => right.scannedAt - left.scannedAt)[0]

    if (!previous) continue
    const growthBytes = Math.max(0, entry.size - previous.size)
    if (growthBytes < PROJECT_MONITOR_GROWTH_ALERT_BYTES) continue

    await recordEvent(
      'system',
      growthBytes >= 3 * PROJECT_MONITOR_GROWTH_ALERT_BYTES ? 'warning' : 'info',
      `Workspace growth detected: ${path.basename(entry.path)}`,
      undefined,
      {
        kind: 'workspace_growth',
        path: entry.path,
        growthBytes,
        currentSize: entry.size
      }
    )
  }
}
