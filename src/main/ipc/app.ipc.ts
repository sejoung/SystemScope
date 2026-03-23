import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import { setUnsavedSettingsState } from '../app/rendererState'
import { logError, logWarn } from '../services/logging'
import { t } from '../i18n'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
    (_event, payload: { scope?: unknown; message?: unknown; details?: unknown }) => {
      if (!payload || typeof payload !== 'object') {
        logWarn('app-ipc', 'Renderer log rejected due to invalid payload shape')
        return failure('INVALID_INPUT', t('유효하지 않은 로그 payload입니다.'))
      }

      const scope = typeof payload.scope === 'string' ? payload.scope : 'renderer'
      const message = typeof payload.message === 'string' ? payload.message : null
      if (!message) {
        logWarn('app-ipc', 'Renderer log rejected due to invalid message', { scope })
        return failure('INVALID_INPUT', t('유효하지 않은 로그 메시지입니다.'))
      }

      logError(scope, message, payload.details)
      return success(true)
    }
  )

  ipcMain.handle(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, (_event, payload: { hasUnsavedSettings?: unknown }) => {
    if (!payload || typeof payload !== 'object' || typeof payload.hasUnsavedSettings !== 'boolean') {
      logWarn('app-ipc', 'Unsaved settings state rejected due to invalid payload', { payload })
      return failure('INVALID_INPUT', t('유효하지 않은 unsaved settings payload입니다.'))
    }

    setUnsavedSettingsState(payload.hasUnsavedSettings)
    return success(true)
  })
}
