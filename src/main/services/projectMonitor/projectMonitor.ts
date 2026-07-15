import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type { ProjectMonitorSummary, ProjectMonitorWorkspace, ProjectMonitorCategoryStat } from '@shared/types'
import { AppendOnlyLogStore } from '@main/services/core/appendOnlyLogStore'
import { getLegacyProjectMonitorFilePath, getProjectMonitorFilePath } from '@main/services/core/dataDir'
import { getActiveProfile } from '@main/services/profile/profileManager'
import { getDirSizeEstimate } from '../../utils/getDirSize'
import { logInfo, logWarn } from '@main/services/core/logging'
import { registerShellPaths } from '@main/services/devtools/shellPathRegistry'
import { recordEvent } from '@main/services/history/eventStore'
import { runWithConcurrency } from '@main/services/core/runWithConcurrency'

interface ProjectMonitorEntry {
  path: string
  size: number
  scannedAt: number
  categories: ProjectMonitorCategoryStat[]
}

const PROJECT_MONITOR_MAX_ENTRIES = 2000
const PROJECT_MONITOR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const PROJECT_MONITOR_REFRESH_MS = 30 * 60 * 1000
const PROJECT_MONITOR_STALE_MS = 60 * 60 * 1000
const PROJECT_MONITOR_GROWTH_ALERT_BYTES = 1024 * 1024 * 1024
const PROJECT_SCAN_CONCURRENCY = 3

let projectMonitorStore: AppendOnlyLogStore<ProjectMonitorEntry> | null = null
let projectMonitorTimer: ReturnType<typeof setTimeout> | null = null
let projectMonitorRunning = false
let refreshInFlight: Promise<void> | null = null
const queuedRefreshPaths = new Set<string>()

function getStore(): AppendOnlyLogStore<ProjectMonitorEntry> {
  if (!projectMonitorStore) {
    projectMonitorStore = new AppendOnlyLogStore<ProjectMonitorEntry>({
      filePath: getProjectMonitorFilePath(),
      legacyFilePath: getLegacyProjectMonitorFilePath(),
      maxEntries: PROJECT_MONITOR_MAX_ENTRIES,
      maxAgeMs: PROJECT_MONITOR_MAX_AGE_MS,
      getTimestamp: (entry) => entry.scannedAt,
      logScope: 'project-monitor-store'
    })
  }
  return projectMonitorStore
}

export async function getProjectMonitorSummary(): Promise<ProjectMonitorSummary> {
  const entries = await getStore().load()
  const histories = buildWorkspaceHistoryIndex(entries)
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
    workspacePaths.map(async (workspacePath) => {
      const resolvedPath = path.resolve(workspacePath)
      return summarizeWorkspace(resolvedPath, histories.get(resolvedPath) ?? [])
    })
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

export function refreshProjectMonitor(pathsOverride?: string[]): Promise<void> {
  const activeProfile = getActiveProfile()
  const workspacePaths = pathsOverride ?? activeProfile?.workspacePaths ?? []
  for (const workspacePath of workspacePaths) queuedRefreshPaths.add(path.resolve(workspacePath))
  if (queuedRefreshPaths.size === 0) return Promise.resolve()
  if (refreshInFlight) return refreshInFlight

  const request = drainRefreshQueue().finally(() => {
    if (refreshInFlight === request) refreshInFlight = null
  })
  refreshInFlight = request
  return request
}

async function drainRefreshQueue(): Promise<void> {
  while (queuedRefreshPaths.size > 0) {
    const uniquePaths = Array.from(queuedRefreshPaths)
    queuedRefreshPaths.clear()
    await scanAndStoreWorkspaces(uniquePaths)
  }
}

async function scanAndStoreWorkspaces(uniquePaths: string[]): Promise<void> {
  const entries: ProjectMonitorEntry[] = Array(uniquePaths.length)
  await runWithConcurrency(uniquePaths.map((workspacePath, index) => ({ workspacePath, index })), PROJECT_SCAN_CONCURRENCY, async ({ workspacePath, index }) => {
    entries[index] = await scanWorkspace(workspacePath)
  })
  await getStore().appendBatch(entries)
  registerShellPaths(uniquePaths, 'descendant')
  await emitWorkspaceGrowthEvents(entries)
  logInfo('project-monitor', 'Project workspaces scanned', { count: entries.length })
}

export function initProjectMonitor(): void {
  stopProjectMonitor()
  projectMonitorRunning = true
  void runScheduledRefresh()
}

export function stopProjectMonitor(): void {
  projectMonitorRunning = false
  if (projectMonitorTimer) {
    clearTimeout(projectMonitorTimer)
    projectMonitorTimer = null
  }
}

async function runScheduledRefresh(): Promise<void> {
  try {
    await refreshProjectMonitor()
  } catch (error) {
    logWarn('project-monitor', 'Scheduled project monitoring scan failed', { error })
  }
  if (!projectMonitorRunning) return
  if (projectMonitorTimer) clearTimeout(projectMonitorTimer)
  projectMonitorTimer = setTimeout(() => { void runScheduledRefresh() }, PROJECT_MONITOR_REFRESH_MS)
  projectMonitorTimer.unref?.()
}

async function summarizeWorkspace(workspacePath: string, entries: ProjectMonitorEntry[]): Promise<ProjectMonitorWorkspace> {
  const resolvedPath = path.resolve(workspacePath)
  const latest = entries[0] ?? null
  const previous = entries[1] ?? null
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
    history: entries
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
  const histories = buildWorkspaceHistoryIndex(historicalEntries)
  for (const entry of entries) {
    const history = histories.get(path.resolve(entry.path)) ?? []
    const previous = history.find((item) => item.scannedAt < entry.scannedAt)

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

function buildWorkspaceHistoryIndex(entries: ProjectMonitorEntry[]): Map<string, ProjectMonitorEntry[]> {
  const histories = new Map<string, ProjectMonitorEntry[]>()
  for (const entry of entries) {
    const resolvedPath = path.resolve(entry.path)
    const history = histories.get(resolvedPath)
    if (history) history.push(entry)
    else histories.set(resolvedPath, [entry])
  }
  for (const history of histories.values()) {
    history.sort((left, right) => right.scannedAt - left.scannedAt)
  }
  return histories
}
