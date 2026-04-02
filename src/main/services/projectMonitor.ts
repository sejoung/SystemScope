import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type { ProjectMonitorSummary, ProjectMonitorWorkspace } from '@shared/types'
import { PersistentStore } from './persistentStore'
import { getProjectMonitorFilePath } from './dataDir'
import { getActiveProfile } from './profileManager'
import { getDirSizeEstimate } from '../utils/getDirSize'
import { logInfo, logWarn } from './logging'
import { registerShellPaths } from './shellPathRegistry'

interface ProjectMonitorEntry {
  path: string
  size: number
  scannedAt: number
}

const PROJECT_MONITOR_SCHEMA_VERSION = 1
const PROJECT_MONITOR_MAX_ENTRIES = 2000
const PROJECT_MONITOR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const PROJECT_MONITOR_REFRESH_MS = 30 * 60 * 1000
const PROJECT_MONITOR_STALE_MS = 60 * 60 * 1000

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
    lastScannedAt: latest?.scannedAt ?? null
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
    scannedAt: Date.now()
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}
