import * as path from 'node:path'
import type { DevToolsOverview } from '@shared/types'
import { getAllProcesses, getNetworkPorts } from '@main/services/process/processMonitor'
import { getActiveProfile } from '@main/services/profile/profileManager'
import { collectEnvironmentChecks } from './devEnvironmentChecks'
import { collectDockerInsight, resetDevToolsOverviewCacheForTest } from './devDockerInsight'
import { collectWorkspaceInsight } from './devWorkspaceInsight'
import { annotateWorkspaceServerUsage, detectDevServers } from './devServerDetection'

export { resetDevToolsOverviewCacheForTest } from './devDockerInsight'
export { findWorkspacePythonInterpreter } from './devWorkspacePython'
export { summarizeGitStatusLines, detectDevServers, detectDevServerKind } from './devServerDetection'

export async function getDevToolsOverview(options?: { forceRefresh?: boolean }): Promise<DevToolsOverview> {
  if (options?.forceRefresh) {
    resetDevToolsOverviewCacheForTest()
  }
  const workspacePaths = Array.from(
    new Set((getActiveProfile()?.workspacePaths ?? []).map((entry) => path.resolve(entry))),
  )

  const [healthChecks, docker, rawWorkspaces, ports, processes] = await Promise.all([
    collectEnvironmentChecks(),
    collectDockerInsight(),
    Promise.all(workspacePaths.map((workspacePath) => collectWorkspaceInsight(workspacePath))),
    getNetworkPorts().catch(() => []),
    getAllProcesses().catch(() => []),
  ])
  const devServers = detectDevServers(ports, processes, workspacePaths)
  const workspaces = annotateWorkspaceServerUsage(rawWorkspaces, devServers)

  return {
    healthChecks,
    docker,
    workspaces,
    devServers,
    scannedAt: Date.now(),
  }
}
