import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { scanAllTools, cleanToolItems } from '../services/toolIntegrations'
import { success, failure } from '@shared/types'
import { logInfoAction, logErrorAction } from '../services/logging'
import { getRequestMeta, isValidStringArray, withRequestMeta, type IpcRequestMetaArg } from './requestContext'
import { recordEvent } from '../services/eventStore'

export function registerDevToolsIpc(): void {
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
