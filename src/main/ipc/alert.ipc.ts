import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { getActiveAlerts, setThresholds, getThresholds, dismissAlert } from '../services/alertManager'
import { setSettings } from '../store/settingsStore'
import { success, failure } from '@shared/types'
import log from 'electron-log'

export function registerAlertIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ALERT_GET_ACTIVE, () => {
    return success(getActiveAlerts())
  })

  ipcMain.handle(IPC_CHANNELS.ALERT_UPDATE_THRESHOLDS, (_event, thresholds: Record<string, number>) => {
    if (!thresholds || typeof thresholds !== 'object') {
      return failure('INVALID_INPUT', '유효하지 않은 임계치 값입니다.')
    }

    for (const [key, val] of Object.entries(thresholds)) {
      if (typeof val !== 'number' || val < 0 || val > 100) {
        return failure('THRESHOLD_INVALID', `유효하지 않은 임계치: ${key}`)
      }
    }

    try {
      setThresholds(thresholds)
      setSettings({ thresholds: { ...getThresholds() } })
      return success(getThresholds())
    } catch (err) {
      log.error('Failed to update thresholds', err)
      return failure('UNKNOWN_ERROR', '임계치 저장에 실패했습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.ALERT_DISMISS, (_event, alertId: string) => {
    if (!alertId || typeof alertId !== 'string') {
      return failure('INVALID_INPUT', '유효하지 않은 알림 ID입니다.')
    }
    try {
      const dismissed = dismissAlert(alertId)
      if (!dismissed) {
        return failure('UNKNOWN_ERROR', '알림을 찾을 수 없습니다.')
      }
      return success(true)
    } catch (err) {
      log.error('Failed to dismiss alert', err)
      return failure('UNKNOWN_ERROR', '알림 해제에 실패했습니다.')
    }
  })
}
