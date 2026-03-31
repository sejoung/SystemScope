import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { success, failure } from '@shared/types'
import { getAlertIntelligence, getAlertHistory } from '../services/alertHistory'
import { logErrorAction, logInfoAction } from '../services/logging'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerAlertIntelligenceIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ALERT_GET_INTELLIGENCE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const intelligence = await getAlertIntelligence()
      logInfoAction('alert-intelligence-ipc', 'intelligence.get', withRequestMeta(requestMeta, {
        activeCount: intelligence.activeAlerts.length,
        patternCount: intelligence.patterns.length,
        sustainedCount: intelligence.sustainedAlerts.length
      }))
      return success(intelligence)
    } catch (err) {
      logErrorAction('alert-intelligence-ipc', 'intelligence.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get alert intelligence')
    }
  })

  ipcMain.handle(IPC_CHANNELS.ALERT_GET_HISTORY, async (_event, limit?: number, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const history = await getAlertHistory(limit ?? undefined)
      logInfoAction('alert-intelligence-ipc', 'history.get', withRequestMeta(requestMeta, { count: history.length }))
      return success(history)
    } catch (err) {
      logErrorAction('alert-intelligence-ipc', 'history.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', 'Failed to get alert history')
    }
  })
}
