import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getActiveAlerts, dismissAlert } from '../services/alertManager'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

export function registerAlertIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ALERT_GET_ACTIVE, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const alerts = getActiveAlerts()
    logInfoAction('alert-ipc', 'alerts.list', withRequestMeta(requestMeta, { count: alerts.length }))
    return success(alerts)
  })

  ipcMain.handle(IPC_CHANNELS.ALERT_DISMISS, (_event, alertId: string, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!alertId || typeof alertId !== 'string') {
      logWarnAction('alert-ipc', 'alert.dismiss', withRequestMeta(requestMeta, { alertId, reason: 'invalid_input' }))
      return failure('INVALID_INPUT', tk('main.alert.error.invalid_id'))
    }
    try {
      const dismissed = dismissAlert(alertId)
      if (!dismissed) {
        logWarnAction('alert-ipc', 'alert.dismiss', withRequestMeta(requestMeta, { alertId, reason: 'not_found' }))
        return failure('UNKNOWN_ERROR', tk('main.alert.error.not_found'))
      }
      logInfoAction('alert-ipc', 'alert.dismiss', withRequestMeta(requestMeta, { alertId }))
      return success(true)
    } catch (err) {
      logErrorAction('alert-ipc', 'alert.dismiss', withRequestMeta(requestMeta, { alertId, error: err }))
      return failure('UNKNOWN_ERROR', tk('main.alert.error.dismiss_failed'))
    }
  })
}
