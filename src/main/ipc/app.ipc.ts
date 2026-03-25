import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import { setUnsavedSettingsState } from '../app/rendererState'
import { logError, logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getAboutInfo, getHomepageUrl, openAboutWindow } from '../app/aboutWindow'

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
    (_event, payload: { scope?: unknown; message?: unknown; details?: unknown }) => {
      if (!payload || typeof payload !== 'object') {
        logWarnAction('app-ipc', 'renderer_error.log', { reason: 'invalid_payload_shape' })
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_payload'))
      }

      const scope = typeof payload.scope === 'string' ? payload.scope : 'renderer'
      const message = typeof payload.message === 'string' ? payload.message : null
      if (!message) {
        logWarnAction('app-ipc', 'renderer_error.log', { scope, reason: 'invalid_message' })
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_message'))
      }

      logError(scope, message, payload.details)
      return success(true)
    }
  )

  ipcMain.handle(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, (_event, payload: { hasUnsavedSettings?: unknown }) => {
    if (!payload || typeof payload !== 'object' || typeof payload.hasUnsavedSettings !== 'boolean') {
      logWarnAction('app-ipc', 'settings.unsaved.update', { reason: 'invalid_payload', payload })
      return failure('INVALID_INPUT', tk('main.app.error.invalid_unsaved_payload'))
    }

    setUnsavedSettingsState(payload.hasUnsavedSettings)
    logInfoAction('app-ipc', 'settings.unsaved.update', { hasUnsavedSettings: payload.hasUnsavedSettings })
    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_ABOUT_INFO, () => {
    const aboutInfo = getAboutInfo()
    logInfoAction('app-ipc', 'about.info.get')
    return success(aboutInfo)
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_ABOUT, (event) => {
    try {
      void event
      openAboutWindow()
      logInfoAction('app-ipc', 'about.window.open')
      return success(true)
    } catch (err) {
      logErrorAction('app-ipc', 'about.window.open', err)
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_about'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_HOMEPAGE, async () => {
    const homepage = getHomepageUrl()
    if (!homepage) {
      logWarnAction('app-ipc', 'homepage.open', { reason: 'missing_url' })
      return failure('INVALID_INPUT', tk('main.app.error.open_homepage'))
    }

    try {
      const parsed = new URL(homepage)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        logWarnAction('app-ipc', 'homepage.open', { reason: 'unsupported_protocol', protocol: parsed.protocol })
        return failure('PERMISSION_DENIED', tk('main.app.error.open_homepage'))
      }
      await shell.openExternal(parsed.toString())
      logInfoAction('app-ipc', 'homepage.open', { url: parsed.toString() })
      return success(true)
    } catch (err) {
      logErrorAction('app-ipc', 'homepage.open', err)
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_homepage'))
    }
  })
}
