import * as path from 'node:path'
import type { DevToolsOverview } from '@shared/types'
import { getAllProcesses, getNetworkPorts } from '@main/services/process/processMonitor'
import { getActiveProfile } from '@main/services/profile/profileManager'
import { collectEnvironmentChecks } from './overview/devEnvironmentChecks'
import { collectDockerInsight, resetDevToolsOverviewCacheForTest as resetDockerOverviewCache } from './overview/devDockerInsight'
import { collectWorkspaceInsight } from './overview/devWorkspaceInsight'
import { annotateWorkspaceServerUsage, detectDevServers } from './overview/devServerDetection'
import { runWithConcurrency } from '@main/services/core/runWithConcurrency'

export { findWorkspacePythonInterpreter } from './overview/devWorkspacePython'
export { summarizeGitStatusLines, detectDevServers, detectDevServerKind } from './overview/devServerDetection'

const OVERVIEW_CACHE_TTL_MS = 15_000
const WORKSPACE_CONCURRENCY = 3
let cachedOverview: { key: string; data: DevToolsOverview; cachedAt: number } | null = null
let pendingOverview: { key: string; promise: Promise<DevToolsOverview> } | null = null

export function resetDevToolsOverviewCacheForTest(): void {
  cachedOverview = null
  pendingOverview = null
  resetDockerOverviewCache()
}

export function getDevToolsOverview(options?: { forceRefresh?: boolean }): Promise<DevToolsOverview> {
  if (options?.forceRefresh) resetDevToolsOverviewCacheForTest()

  const workspacePaths = Array.from(
    new Set((getActiveProfile()?.workspacePaths ?? []).map((entry) => path.resolve(entry))),
  )
  const cacheKey = workspacePaths.join('\n')
  const now = Date.now()
  if (cachedOverview?.key === cacheKey && now - cachedOverview.cachedAt < OVERVIEW_CACHE_TTL_MS) {
    return Promise.resolve(cachedOverview.data)
  }
  if (pendingOverview?.key === cacheKey) return pendingOverview.promise

  const request = collectDevToolsOverview(workspacePaths).then((data) => {
    cachedOverview = { key: cacheKey, data, cachedAt: Date.now() }
    return data
  }).finally(() => {
    if (pendingOverview?.promise === request) pendingOverview = null
  })
  pendingOverview = { key: cacheKey, promise: request }
  return request
}

async function collectDevToolsOverview(workspacePaths: string[]): Promise<DevToolsOverview> {
  const rawWorkspaces: DevToolsOverview['workspaces'] = Array(workspacePaths.length)
  const workspaceCollection = runWithConcurrency(
    workspacePaths.map((workspacePath, index) => ({ workspacePath, index })),
    WORKSPACE_CONCURRENCY,
    async ({ workspacePath, index }) => {
      rawWorkspaces[index] = await collectWorkspaceInsight(workspacePath)
    },
  ).then(() => rawWorkspaces)

  const [healthChecks, docker, collectedWorkspaces, ports, processes] = await Promise.all([
    collectEnvironmentChecks(),
    collectDockerInsight(),
    workspaceCollection,
    getNetworkPorts().catch(() => []),
    getAllProcesses().catch(() => []),
  ])
  const devServers = detectDevServers(ports, processes, workspacePaths)
  const workspaces = annotateWorkspaceServerUsage(collectedWorkspaces, devServers)

  return {
    healthChecks,
    docker,
    workspaces,
    devServers,
    scannedAt: Date.now(),
  }
}
