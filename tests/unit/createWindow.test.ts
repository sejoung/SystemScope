import { beforeEach, describe, expect, it, vi } from 'vitest'

const browserWindowMock = vi.hoisted(() => vi.fn())
const dialogShowMessageBoxSyncMock = vi.hoisted(() => vi.fn())
const restoreWindowStateMock = vi.hoisted(() => vi.fn())
const saveWindowStateMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const getUnsavedSettingsStateMock = vi.hoisted(() => vi.fn())
const setUnsavedSettingsStateMock = vi.hoisted(() => vi.fn())
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
  setUnsavedSettingsState: setUnsavedSettingsStateMock
}))

vi.mock('../../src/main/i18n', () => ({
  tk: tkMock
}))

describe('createMainWindow', () => {
  beforeEach(() => {
    vi.resetModules()
    browserWindowMock.mockReset()
    dialogShowMessageBoxSyncMock.mockReset()
    restoreWindowStateMock.mockReset()
    saveWindowStateMock.mockReset()
    getSettingsMock.mockReset()
    getUnsavedSettingsStateMock.mockReset()
    setUnsavedSettingsStateMock.mockReset()
    tkMock.mockClear()

    restoreWindowStateMock.mockReturnValue(null)
    getSettingsMock.mockReturnValue({ theme: 'dark' })
    getUnsavedSettingsStateMock.mockReturnValue(false)

    browserWindowMock.mockImplementation(function mockBrowserWindow(_options: unknown) {
      return {
      once: vi.fn(),
      on: vi.fn(),
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
})
