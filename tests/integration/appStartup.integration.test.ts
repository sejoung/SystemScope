import { beforeEach, describe, expect, it, vi } from 'vitest'

const whenReadyCallbacks = vi.hoisted(() => [] as Array<() => void>)
const appEventHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => void>())
const initializeRuntimeSettingsMock = vi.hoisted(() => vi.fn())
const ensureSnapshotDirMock = vi.hoisted(() => vi.fn())
const registerAllIpcMock = vi.hoisted(() => vi.fn())
const startSnapshotSchedulerMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const createTrayMock = vi.hoisted(() => vi.fn())
const createMainWindowMock = vi.hoisted(() => vi.fn())
const setForceQuitMock = vi.hoisted(() => vi.fn())
const initializeLoggingMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())
const executeGracefulShutdownMock = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const initializeShutdownHandlersMock = vi.hoisted(() => vi.fn())
const markQuitAfterShutdownMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    whenReady: () => {
      const thenChain = {
        then: (callback: () => void) => {
          whenReadyCallbacks.push(callback)
          return { catch: vi.fn() }
        }
      }
      return thenChain
    },
    on: (event: string, handler: (...args: unknown[]) => void) => {
      appEventHandlers.set(event, handler)
    },
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/systemscope-test'
      return '/tmp'
    }),
    quit: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/app/createWindow', () => ({
  createMainWindow: createMainWindowMock,
  setForceQuit: setForceQuitMock
}))

vi.mock('../../src/main/ipc', () => ({
  registerAllIpc: registerAllIpcMock
}))

vi.mock('../../src/main/app/initializeRuntimeSettings', () => ({
  initializeRuntimeSettings: initializeRuntimeSettingsMock
}))

vi.mock('../../src/main/services/growthAnalyzer', () => ({
  startSnapshotScheduler: startSnapshotSchedulerMock
}))

vi.mock('../../src/main/services/snapshotStore', () => ({
  ensureSnapshotDir: ensureSnapshotDirMock
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: getSettingsMock
}))

vi.mock('../../src/main/app/tray', () => ({
  createTray: createTrayMock
}))

vi.mock('../../src/main/services/logging', () => ({
  initializeLogging: initializeLoggingMock,
  logError: logErrorMock
}))

vi.mock('../../src/main/app/shutdown', () => ({
  executeGracefulShutdown: executeGracefulShutdownMock,
  initializeShutdownHandlers: initializeShutdownHandlersMock,
  markQuitAfterShutdown: markQuitAfterShutdownMock
}))

describe('app startup integration', () => {
  beforeEach(() => {
    vi.resetModules()
    whenReadyCallbacks.length = 0
    appEventHandlers.clear()
    initializeRuntimeSettingsMock.mockReset()
    ensureSnapshotDirMock.mockReset()
    registerAllIpcMock.mockReset()
    startSnapshotSchedulerMock.mockReset()
    getSettingsMock.mockReset()
    createTrayMock.mockReset()
    createMainWindowMock.mockReset()
    setForceQuitMock.mockReset()
    initializeLoggingMock.mockReset()
    logErrorMock.mockReset()
    executeGracefulShutdownMock.mockReset()
    executeGracefulShutdownMock.mockReturnValue(Promise.resolve())
    initializeShutdownHandlersMock.mockReset()
    markQuitAfterShutdownMock.mockReset()
    getSettingsMock.mockReturnValue({
      thresholds: {
        diskWarning: 80,
        diskCritical: 90,
        memoryWarning: 80,
        memoryCritical: 90,
        gpuMemoryWarning: 80,
        gpuMemoryCritical: 90
      },
      theme: 'dark',
      snapshotIntervalMin: 30
    })
  })

  it('should initialize runtime services and window creation on app ready', async () => {
    await import('../../src/main/app/index')

    expect(whenReadyCallbacks).toHaveLength(1)

    whenReadyCallbacks[0]()

    expect(initializeLoggingMock).toHaveBeenCalledTimes(1)
    expect(initializeShutdownHandlersMock).toHaveBeenCalledTimes(1)
    expect(initializeRuntimeSettingsMock).toHaveBeenCalledTimes(1)
    expect(ensureSnapshotDirMock).toHaveBeenCalledTimes(1)
    expect(registerAllIpcMock).toHaveBeenCalledTimes(1)
    expect(startSnapshotSchedulerMock).toHaveBeenCalledWith(30 * 60 * 1000)
    expect(createTrayMock).toHaveBeenCalledTimes(1)
    expect(createMainWindowMock).toHaveBeenCalledTimes(1)
  })

  it('should clean up services on app shutdown events', async () => {
    await import('../../src/main/app/index')

    const beforeQuit = appEventHandlers.get('before-quit')
    const windowAllClosed = appEventHandlers.get('window-all-closed')

    expect(beforeQuit).toBeTypeOf('function')
    expect(windowAllClosed).toBeTypeOf('function')

    // before-quit handler expects an event with preventDefault
    const mockEvent = { preventDefault: vi.fn() }
    beforeQuit?.(mockEvent)

    // First call: preventDefault is called, graceful shutdown starts
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(markQuitAfterShutdownMock).toHaveBeenCalledTimes(1)
    expect(executeGracefulShutdownMock).toHaveBeenCalledWith('before-quit')
  })
})
