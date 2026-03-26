import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { failure, success } from '@shared/types'
import { setUnsavedSettingsState } from '../app/rendererState'
import { logError, logErrorAction, logInfoAction, logWarnAction } from '../services/logging'
import { tk } from '../i18n'
import { getAboutInfo, getHomepageUrl, openAboutWindow } from '../app/aboutWindow'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

const MAX_RENDERER_SCOPE_LENGTH = 120
const MAX_RENDERER_MESSAGE_LENGTH = 1000
const MAX_RENDERER_DETAIL_KEYS = 20
const MAX_RENDERER_DETAIL_DEPTH = 3
const MAX_RENDERER_DETAIL_ARRAY = 20
const MAX_RENDERER_DETAIL_STRING_LENGTH = 500

export function registerAppIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
    (_event, payload: { scope?: unknown; message?: unknown; details?: unknown }, metaArg?: IpcRequestMetaArg) => {
      const requestMeta = getRequestMeta(metaArg)
      if (!payload || typeof payload !== 'object') {
        logWarnAction('app-ipc', 'renderer_error.log', withRequestMeta(requestMeta, { reason: 'invalid_payload_shape' }))
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_payload'))
      }

      const scope = sanitizeRendererLogScope(payload.scope)
      const message = typeof payload.message === 'string'
        ? payload.message.trim().slice(0, MAX_RENDERER_MESSAGE_LENGTH)
        : null
      if (!message) {
        logWarnAction('app-ipc', 'renderer_error.log', withRequestMeta(requestMeta, { scope, reason: 'invalid_message' }))
        return failure('INVALID_INPUT', tk('main.app.error.invalid_log_message'))
      }

      logError(scope, message, sanitizeRendererLogDetails(payload.details))
      return success(true)
    }
  )

  ipcMain.handle(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, (event, payload: { hasUnsavedSettings?: unknown }, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!payload || typeof payload !== 'object' || typeof payload.hasUnsavedSettings !== 'boolean') {
      logWarnAction('app-ipc', 'settings.unsaved.update', withRequestMeta(requestMeta, { reason: 'invalid_payload', payload }))
      return failure('INVALID_INPUT', tk('main.app.error.invalid_unsaved_payload'))
    }

    if (!event?.sender || typeof event.sender.id !== 'number') {
      logWarnAction('app-ipc', 'settings.unsaved.update', withRequestMeta(requestMeta, { reason: 'invalid_sender' }))
      return failure('INVALID_INPUT', tk('main.app.error.invalid_unsaved_payload'))
    }

    setUnsavedSettingsState(event.sender.id, payload.hasUnsavedSettings)
    logInfoAction('app-ipc', 'settings.unsaved.update', withRequestMeta(requestMeta, {
      senderId: event.sender.id,
      hasUnsavedSettings: payload.hasUnsavedSettings
    }))
    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_ABOUT_INFO, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const aboutInfo = getAboutInfo()
    logInfoAction('app-ipc', 'about.info.get', withRequestMeta(requestMeta))
    return success(aboutInfo)
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_ABOUT, (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      openAboutWindow()
      logInfoAction('app-ipc', 'about.window.open', withRequestMeta(requestMeta))
      return success(true)
    } catch (err) {
      logErrorAction('app-ipc', 'about.window.open', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_about'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_HOMEPAGE, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    const homepage = getHomepageUrl()
    if (!homepage) {
      logWarnAction('app-ipc', 'homepage.open', withRequestMeta(requestMeta, { reason: 'missing_url' }))
      return failure('INVALID_INPUT', tk('main.app.error.open_homepage'))
    }

    try {
      const parsed = new URL(homepage)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        logWarnAction('app-ipc', 'homepage.open', withRequestMeta(requestMeta, { reason: 'unsupported_protocol', protocol: parsed.protocol }))
        return failure('PERMISSION_DENIED', tk('main.app.error.open_homepage'))
      }
      await shell.openExternal(parsed.toString())
      logInfoAction('app-ipc', 'homepage.open', withRequestMeta(requestMeta, { url: parsed.toString() }))
      return success(true)
    } catch (err) {
      logErrorAction('app-ipc', 'homepage.open', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.app.error.open_homepage'))
    }
  })
}

function sanitizeRendererLogScope(scope: unknown): string {
  if (typeof scope !== 'string') {
    return 'renderer'
  }

  const trimmed = scope.trim()
  return trimmed ? trimmed.slice(0, MAX_RENDERER_SCOPE_LENGTH) : 'renderer'
}

function sanitizeRendererLogDetails(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (depth >= MAX_RENDERER_DETAIL_DEPTH) {
    return '[MaxDepthExceeded]'
  }

  if (typeof value === 'string') {
    return value.length > MAX_RENDERER_DETAIL_STRING_LENGTH
      ? `${value.slice(0, MAX_RENDERER_DETAIL_STRING_LENGTH)}…[truncated]`
      : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_RENDERER_DETAIL_ARRAY)
      .map((entry) => sanitizeRendererLogDetails(entry, depth + 1))
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, MAX_RENDERER_MESSAGE_LENGTH)
    }
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_RENDERER_DETAIL_KEYS)
        .map(([key, entry]) => [key.slice(0, 80), sanitizeRendererLogDetails(entry, depth + 1)])
    )
  }

  return String(value).slice(0, MAX_RENDERER_DETAIL_STRING_LENGTH)
}
