import { beforeEach, describe, expect, it, vi } from 'vitest'

const browserWindowMock = vi.hoisted(() => vi.fn())
const dialogShowMessageBoxSyncMock = vi.hoisted(() => vi.fn())
const restoreWindowStateMock = vi.hoisted(() => vi.fn())
const saveWindowStateMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const getUnsavedSettingsStateMock = vi.hoisted(() => vi.fn())
const setUnsavedSettingsStateMock = vi.hoisted(() => vi.fn())
const clearUnsavedSettingsStateMock = vi.hoisted(() => vi.fn())
const tkMock = vi.hoisted(() => vi.fn((key: string) => key))

vi.mock('electron', () => ({
  BrowserWindow: browserWindowMock,
  dialog: {
    showMessageBoxSync: dialogShowMessageBoxSyncMock
  }
}))

vi.mock('../../src/main/store/windowState', () => ({
  restoreWindowState: restoreWindowStateMock,
  saveWindowState: saveWindowStateMock
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: getSettingsMock
}))

vi.mock('../../src/main/app/rendererState', () => ({
  getUnsavedSettingsState: getUnsavedSettingsStateMock,
  setUnsavedSettingsState: setUnsavedSettingsStateMock,
  clearUnsavedSettingsState: clearUnsavedSettingsStateMock
}))

vi.mock('../../src/main/i18n', () => ({
  tk: tkMock
}))

describe('createMainWindow', () => {
  let eventHandlers: Record<string, ((...args: unknown[]) => void) | undefined>
  let webContentsHandlers: Record<string, ((...args: unknown[]) => void) | undefined>
  let webContentsMock: {
    id: number
    on: ReturnType<typeof vi.fn>
    openDevTools: ReturnType<typeof vi.fn>
    closeDevTools: ReturnType<typeof vi.fn>
    isDevToolsOpened: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.resetModules()
    browserWindowMock.mockReset()
    dialogShowMessageBoxSyncMock.mockReset()
    restoreWindowStateMock.mockReset()
    saveWindowStateMock.mockReset()
    getSettingsMock.mockReset()
    getUnsavedSettingsStateMock.mockReset()
    setUnsavedSettingsStateMock.mockReset()
    clearUnsavedSettingsStateMock.mockReset()
    tkMock.mockClear()
    eventHandlers = {}
    webContentsHandlers = {}

    restoreWindowStateMock.mockReturnValue(null)
    getSettingsMock.mockReturnValue({ theme: 'dark' })
    getUnsavedSettingsStateMock.mockReturnValue(false)
    delete process.env.NODE_ENV
    delete process.env.ELECTRON_RENDERER_URL

    webContentsMock = {
      id: 42,
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        webContentsHandlers[event] = handler
      }),
      openDevTools: vi.fn(),
      closeDevTools: vi.fn(),
      isDevToolsOpened: vi.fn(() => false)
    }

    browserWindowMock.mockImplementation(function mockBrowserWindow() {
      return {
        webContents: webContentsMock,
        once: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          eventHandlers[event] = handler
        }),
        loadURL: vi.fn(),
        loadFile: vi.fn(),
        maximize: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        close: vi.fn()
      }
    })
  })

  it('should configure minimum window dimensions', async () => {
    const { createMainWindow } = await import('../../src/main/app/createWindow')
    createMainWindow()

    expect(browserWindowMock).toHaveBeenCalledTimes(1)
    expect(browserWindowMock.mock.calls[0][0]).toMatchObject({
      minWidth: 1100,
      minHeight: 700
    })
  })

  it('should read unsaved settings state for the current window sender id', async () => {
    const { createMainWindow } = await import('../../src/main/app/createWindow')
    createMainWindow()

    const preventDefault = vi.fn()
    eventHandlers.close?.({ preventDefault })

    expect(getUnsavedSettingsStateMock).toHaveBeenCalledWith(42)
  })

  it('should clear unsaved settings state when the window is closed', async () => {
    const { createMainWindow } = await import('../../src/main/app/createWindow')
    createMainWindow()

    eventHandlers.closed?.()

    expect(clearUnsavedSettingsStateMock).toHaveBeenCalledWith(42)
  })

  it('should register a devtools shortcut only in development mode', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'

    const { createMainWindow } = await import('../../src/main/app/createWindow')
    createMainWindow()

    expect(webContentsMock.on).toHaveBeenCalledWith('before-input-event', expect.any(Function))
    expect(webContentsHandlers['before-input-event']).toBeTypeOf('function')
  })

  it('should open devtools on F12 in development mode', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'

    const { createMainWindow } = await import('../../src/main/app/createWindow')
    createMainWindow()

    webContentsHandlers['before-input-event']?.({}, {
      type: 'keyDown',
      key: 'F12',
      shift: false,
      control: false,
      meta: false
    })

    expect(webContentsMock.openDevTools).toHaveBeenCalledWith({ mode: 'detach' })
  })
})
