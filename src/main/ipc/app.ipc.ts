import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import { setUnsavedSettingsState } from '../app/rendererState'
import { logError, logWarn } from '../services/logging'
import { tk } from '../i18n'
import { getAboutInfo, getHomepageUrl, openAboutWindow } from '../app/aboutWindow'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
    (_event, payload: { scope?: unknown; message?: unknown; details?: unknown }) => {
      if (!payload || typeof payload !== 'object') {
        logWarn('app-ipc', 'Renderer log rejected due to invalid payload shape')
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_payload'))
      }

      const scope = typeof payload.scope === 'string' ? payload.scope : 'renderer'
      const message = typeof payload.message === 'string' ? payload.message : null
      if (!message) {
        logWarn('app-ipc', 'Renderer log rejected due to invalid message', { scope })
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_message'))
      }

      logError(scope, message, payload.details)
      return success(true)
    }
  )

  ipcMain.handle(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, (_event, payload: { hasUnsavedSettings?: unknown }) => {
    if (!payload || typeof payload !== 'object' || typeof payload.hasUnsavedSettings !== 'boolean') {
      logWarn('app-ipc', 'Unsaved settings state rejected due to invalid payload', { payload })
      return failure('INVALID_INPUT', tk('main.app.error.invalid_unsaved_payload'))
    }

    setUnsavedSettingsState(payload.hasUnsavedSettings)
    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_ABOUT_INFO, () => {
    return success(getAboutInfo())
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_ABOUT, (event) => {
    try {
      void event
      openAboutWindow()
      return success(true)
    } catch (err) {
      logError('app-ipc', 'Failed to open About window', err)
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_about'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_HOMEPAGE, async () => {
    const homepage = getHomepageUrl()
    if (!homepage) {
      return failure('INVALID_INPUT', tk('main.app.error.open_homepage'))
    }

    try {
      const parsed = new URL(homepage)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return failure('PERMISSION_DENIED', tk('main.app.error.open_homepage'))
      }
      await shell.openExternal(parsed.toString())
      return success(true)
    } catch (err) {
      logError('app-ipc', 'Failed to open homepage', err)
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_homepage'))
    }
  })
}
