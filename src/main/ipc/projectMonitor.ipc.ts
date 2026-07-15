import { ipcMain } from './_shared/trustedIpc'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { getProjectMonitorSummary } from '@main/services/projectMonitor'
import { logErrorAction, logInfoAction } from '@main/services/core'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './_shared/requestContext'

export function registerProjectMonitorIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_MONITOR_GET_SUMMARY, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const summary = await getProjectMonitorSummary()
      logInfoAction('project-monitor-ipc', 'projectMonitor.getSummary', withRequestMeta(requestMeta, {
        workspaceCount: summary.workspaces.length,
        totalGrowth: summary.totalRecentGrowthBytes
      }))
      return success(summary)
    } catch (err) {
      logErrorAction('project-monitor-ipc', 'projectMonitor.getSummary', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get project monitor summary')
    }
  })
}
