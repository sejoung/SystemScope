import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getActiveAlerts, dismissAlert } from '../services/alertManager'
import { success, failure } from '@shared/types'
import { logError, logInfo, logWarn } from '../services/logging'
import { t } from '../i18n'

export function registerAlertIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ALERT_GET_ACTIVE, () => {
    return success(getActiveAlerts())
  })

  ipcMain.handle(IPC_CHANNELS.ALERT_DISMISS, (_event, alertId: string) => {
    if (!alertId || typeof alertId !== 'string') {
      logWarn('alert-ipc', 'Alert dismiss rejected due to invalid input', { alertId })
      return failure('INVALID_INPUT', t('유효하지 않은 알림 ID입니다.'))
    }
    try {
      const dismissed = dismissAlert(alertId)
      if (!dismissed) {
        logWarn('alert-ipc', 'Alert dismiss failed because alert was not found', { alertId })
        return failure('UNKNOWN_ERROR', t('알림을 찾을 수 없습니다.'))
      }
      logInfo('alert-ipc', 'Alert dismissed', { alertId })
      return success(true)
    } catch (err) {
      logError('alert-ipc', 'Failed to dismiss alert', err)
      return failure('UNKNOWN_ERROR', t('알림 해제에 실패했습니다.'))
    }
  })
}
