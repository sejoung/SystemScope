import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { getProjectMonitorSummary } from '../services/projectMonitor'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

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
