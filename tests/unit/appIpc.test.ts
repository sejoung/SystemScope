import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const logError = vi.hoisted(() => vi.fn())
const logInfo = vi.hoisted(() => vi.fn())
const logWarn = vi.hoisted(() => vi.fn())
const logInfoAction = vi.hoisted(() => vi.fn())
const logWarnAction = vi.hoisted(() => vi.fn())
const logErrorAction = vi.hoisted(() => vi.fn())
const setUnsavedSettingsState = vi.hoisted(() => vi.fn())
const getAboutInfo = vi.hoisted(() => vi.fn())
const getHomepageUrl = vi.hoisted(() => vi.fn())
const openAboutWindow = vi.hoisted(() => vi.fn())
const openExternal = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: (contents: unknown) => contents
  },
  shell: {
    openExternal
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('electron-log', () => ({
  default: {
    error: logError,
    info: logInfo,
    warn: logWarn
  }
}))

vi.mock('../../src/main/services/logging', () => ({
  logError,
  logInfoAction,
  logWarnAction,
  logErrorAction
}))

vi.mock('../../src/main/app/rendererState', () => ({
  setUnsavedSettingsState
}))

vi.mock('../../src/main/app/aboutWindow', () => ({
  getAboutInfo,
  getHomepageUrl,
  openAboutWindow
}))

describe('registerAppIpc', () => {
  beforeEach(() => {
    handlers.clear()
    logError.mockReset()
    logInfo.mockReset()
    logWarn.mockReset()
    logInfoAction.mockReset()
    logWarnAction.mockReset()
    logErrorAction.mockReset()
    setUnsavedSettingsState.mockReset()
    getAboutInfo.mockReset()
    getHomepageUrl.mockReset()
    openAboutWindow.mockReset()
    openExternal.mockReset()
  })

  it('should log renderer errors with normalized scope and details', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_LOG_RENDERER_ERROR)
    expect(handler).toBeTypeOf('function')

    const payload = {
      scope: 'error-boundary',
      message: 'Failed to render section',
      details: { componentStack: 'stack' }
    }

    const result = handler?.({}, payload) as { ok: boolean; data?: boolean }
    expect(result.ok).toBe(true)
    expect(result.data).toBe(true)
    expect(logError).toHaveBeenCalledWith('error-boundary', 'Failed to render section', payload.details)
  })

  it('should reject malformed renderer log payloads', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_LOG_RENDERER_ERROR)
    expect(handler).toBeTypeOf('function')

    const invalidPayloadResult = handler?.({}, null) as { ok: boolean; error?: { code: string } }
    expect(invalidPayloadResult.ok).toBe(false)
    expect(invalidPayloadResult.error?.code).toBe('INVALID_INPUT')
    expect(logWarnAction).toHaveBeenCalled()

    const invalidMessageResult = handler?.({}, { scope: 1, message: '' }) as { ok: boolean; error?: { code: string } }
    expect(invalidMessageResult.ok).toBe(false)
    expect(invalidMessageResult.error?.code).toBe('INVALID_INPUT')
  })

  it('should persist unsaved settings state from renderer', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS)
    expect(handler).toBeTypeOf('function')

    const result = handler?.({}, { hasUnsavedSettings: true }) as { ok: boolean; data?: boolean }
    expect(result.ok).toBe(true)
    expect(result.data).toBe(true)
    expect(setUnsavedSettingsState).toHaveBeenCalledWith(true)
  })

  it('should reject malformed unsaved settings payloads', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS)
    expect(handler).toBeTypeOf('function')

    const result = handler?.({}, { hasUnsavedSettings: 'yes' }) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_INPUT')
    expect(logWarnAction).toHaveBeenCalled()
  })

  it('should return about info from the main process', async () => {
    getAboutInfo.mockReturnValue({
      appName: 'SystemScope',
      version: '1.0.9',
      author: 'Sejoung',
      homepage: 'https://github.com/sejoung/SystemScope',
      license: 'Apache-2.0'
    })

    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_GET_ABOUT_INFO)
    const result = handler?.({}, undefined) as { ok: boolean; data?: { author: string } }

    expect(result.ok).toBe(true)
    expect(result.data?.author).toBe('Sejoung')
  })

  it('should open the about window for the requesting browser window', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_OPEN_ABOUT)
    const result = handler?.({
      sender: { id: 7 }
    }, undefined) as { ok: boolean; data?: boolean }

    expect(result.ok).toBe(true)
    expect(result.data).toBe(true)
    expect(openAboutWindow).toHaveBeenCalledWith()
  })

  it('should open the homepage via the shell', async () => {
    getHomepageUrl.mockReturnValue('https://github.com/sejoung/SystemScope')

    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_OPEN_HOMEPAGE)
    const result = await handler?.({}, undefined) as { ok: boolean; data?: boolean }

    expect(result.ok).toBe(true)
    expect(result.data).toBe(true)
    expect(openExternal).toHaveBeenCalledWith('https://github.com/sejoung/SystemScope')
  })
})
