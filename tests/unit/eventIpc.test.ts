import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const getEventHistoryMock = vi.hoisted(() => vi.fn())
const getRecentEventsMock = vi.hoisted(() => vi.fn())
const clearEventHistoryMock = vi.hoisted(() => vi.fn())
const logInfoActionMock = vi.hoisted(() => vi.fn())
const logErrorActionMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

vi.mock('../../src/main/services/eventStore', () => ({
  getEventHistory: getEventHistoryMock,
  getRecentEvents: getRecentEventsMock,
  clearEventHistory: clearEventHistoryMock
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfoAction: logInfoActionMock,
  logErrorAction: logErrorActionMock
}))

describe('registerEventIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    getEventHistoryMock.mockReset()
    getRecentEventsMock.mockReset()
    clearEventHistoryMock.mockReset()
    logInfoActionMock.mockReset()
    logErrorActionMock.mockReset()
  })

  it('should clear event history and return the removed count', async () => {
    clearEventHistoryMock.mockResolvedValue(12)

    const { registerEventIpc } = await import('../../src/main/ipc/event.ipc')
    registerEventIpc()

    const handler = handlers.get(IPC_CHANNELS.EVENT_CLEAR_HISTORY)
    const result = await handler?.({}, { __requestMeta: { requestId: 'req-1' } }) as {
      ok: boolean
      data?: number
    }

    expect(clearEventHistoryMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(12)
    expect(logInfoActionMock).toHaveBeenCalled()
  })
})
