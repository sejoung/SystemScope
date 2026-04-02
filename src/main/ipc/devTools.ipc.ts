import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { scanAllTools, cleanToolItems } from '../services/toolIntegrations'
import { getDevToolsOverview } from '../services/devToolsOverview'
import { getAIUsageOverview } from '../services/aiUsageOverview'
import { success, failure } from '@shared/types'
import { logInfoAction, logErrorAction } from '../services/logging'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './requestContext'
import { recordEvent } from '../services/eventStore'

export function registerDevToolsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_AI_USAGE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const overview = await getAIUsageOverview()
      logInfoAction('devtools-ipc', 'tools.aiUsage', withRequestMeta(requestMeta, {
        providerCount: overview.providers.length
      }))
      return success(overview)
    } catch (err) {
      logErrorAction('devtools-ipc', 'tools.aiUsage', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to load AI usage overview.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.TOOLS_GET_OVERVIEW, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const overview = await getDevToolsOverview()
      logInfoAction('devtools-ipc', 'tools.overview', withRequestMeta(requestMeta, {
        healthCheckCount: overview.healthChecks.length,
        workspaceCount: overview.workspaces.length,
        devServerCount: overview.devServers.length
      }))
      return success(overview)
    } catch (err) {
      logErrorAction('devtools-ipc', 'tools.overview', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to load developer tooling overview.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.TOOLS_SCAN_ALL, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const results = await scanAllTools()
      logInfoAction('devtools-ipc', 'tools.scanAll', withRequestMeta(requestMeta, {
        toolCount: results.length,
        tools: results.map((r) => ({ tool: r.tool, status: r.status, reclaimable: r.reclaimable.length }))
      }))
      return success(results)
    } catch (err) {
      logErrorAction('devtools-ipc', 'tools.scanAll', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to scan developer tools.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.TOOLS_CLEAN, async (_event, paths: string[], metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!isValidStringArray(paths)) {
      return failure('INVALID_INPUT', 'No valid paths provided for cleanup.')
    }
    try {
      const result = await cleanToolItems(paths)
      if (result.succeeded.length > 0) {
        void recordEvent('disk_cleanup', 'info', `Cleaned ${result.succeeded.length} developer tool item(s)`, undefined, {
          succeededCount: result.succeeded.length, failedCount: result.failed.length
        })
      }
      logInfoAction('devtools-ipc', 'tools.clean', withRequestMeta(requestMeta, {
        requestedCount: paths.length, succeededCount: result.succeeded.length, failedCount: result.failed.length
      }))
      return success(result)
    } catch (err) {
      logErrorAction('devtools-ipc', 'tools.clean', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to clean developer tool items.')
    }
  })
}
