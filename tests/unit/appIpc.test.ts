import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const logError = vi.hoisted(() => vi.fn())
const setUnsavedSettingsState = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('electron-log', () => ({
  default: {
    error: logError
  }
}))

vi.mock('../../src/main/app/rendererState', () => ({
  setUnsavedSettingsState
}))

describe('registerAppIpc', () => {
  beforeEach(() => {
    handlers.clear()
    logError.mockReset()
    setUnsavedSettingsState.mockReset()
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
    expect(logError).toHaveBeenCalledWith('[error-boundary] Failed to render section', payload.details)
  })

  it('should reject malformed renderer log payloads', async () => {
    const { registerAppIpc } = await import('../../src/main/ipc/app.ipc')
    registerAppIpc()

    const handler = handlers.get(IPC_CHANNELS.APP_LOG_RENDERER_ERROR)
    expect(handler).toBeTypeOf('function')

    const invalidPayloadResult = handler?.({}, null) as { ok: boolean; error?: { code: string } }
    expect(invalidPayloadResult.ok).toBe(false)
    expect(invalidPayloadResult.error?.code).toBe('INVALID_INPUT')

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
  })
})
