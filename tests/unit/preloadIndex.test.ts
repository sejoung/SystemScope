import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorldMock = vi.hoisted(() => vi.fn())
const createIpcApiMock = vi.hoisted(() => vi.fn())
const createE2EMockApiMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock
  }
}))

vi.mock('../../src/preload/createIpcApi', () => ({
  createIpcApi: createIpcApiMock
}))

vi.mock('../../src/preload/createE2EMockApi', () => ({
  createE2EMockApi: createE2EMockApiMock
}))

describe('preload index', () => {
  beforeEach(() => {
    vi.resetModules()
    exposeInMainWorldMock.mockReset()
    createIpcApiMock.mockReset()
    createE2EMockApiMock.mockReset()
    delete process.env.E2E_LIGHTWEIGHT
  })

  it('should expose the preload API to the renderer', async () => {
    const api = {
      getSystemStats: vi.fn(),
      subscribeSystem: vi.fn(),
      getSettings: vi.fn()
    }
    createIpcApiMock.mockReturnValue(api)

    await import('../../src/preload/index')

    expect(exposeInMainWorldMock).toHaveBeenCalledWith('systemScope', api)
    expect(exposeInMainWorldMock).toHaveBeenCalledWith('__E2E_LIGHTWEIGHT', false)
  })
})
