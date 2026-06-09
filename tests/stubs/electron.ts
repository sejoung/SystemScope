/**
 * Test stub for the `electron` module.
 *
 * Unit tests run in plain Node (vitest), not the Electron runtime. Importing the
 * real `electron` package there returns a path string to the binary — and throws
 * outright when the binary isn't installed (as on CI). Either way the API objects
 * (`app`, `BrowserWindow`, …) aren't usable. This stub is wired in via a vitest
 * `resolve.alias`, so any module that does `import { app } from 'electron'` resolves
 * here instead of the real package and never depends on the Electron binary.
 *
 * Tests that need specific Electron behaviour still declare their own
 * `vi.mock('electron', …)`, which takes precedence over this alias.
 */
const noop = (): void => {}

export const app = {
  getPath: () => '/tmp',
  getName: () => 'SystemScope',
  getVersion: () => '0.0.0-test',
  getAppPath: () => process.cwd(),
  on: noop,
  once: noop,
  whenReady: async () => {},
  quit: noop,
  exit: noop,
  setLoginItemSettings: noop,
  getLoginItemSettings: () => ({ openAtLogin: false }),
  requestSingleInstanceLock: () => true,
  setAppUserModelId: noop,
  dock: { setIcon: noop, show: noop, hide: noop },
}

export class BrowserWindow {
  webContents = {
    on: noop,
    send: noop,
    id: 1,
    openDevTools: noop,
    closeDevTools: noop,
    isDevToolsOpened: () => false,
    setWindowOpenHandler: noop,
  }
  static getAllWindows(): BrowserWindow[] {
    return []
  }
  static getFocusedWindow(): BrowserWindow | null {
    return null
  }
  on(): this {
    return this
  }
  once(): this {
    return this
  }
  loadURL = noop
  loadFile = noop
  show = noop
  hide = noop
  close = noop
  destroy = noop
  focus = noop
  restore = noop
  minimize = noop
  maximize = noop
  isDestroyed = () => false
  isMinimized = () => false
  isMaximized = () => false
  isVisible = () => true
  getBounds = () => ({ x: 0, y: 0, width: 0, height: 0 })
  setBounds = noop
}

export const dialog = {
  showMessageBox: async () => ({ response: 0, checkboxChecked: false }),
  showMessageBoxSync: () => 0,
  showSaveDialog: async () => ({ canceled: true, filePath: undefined }),
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showErrorBox: noop,
}

export const shell = {
  openPath: async () => '',
  showItemInFolder: noop,
  trashItem: async () => {},
  openExternal: async () => {},
}

export const ipcMain = {
  handle: noop,
  handleOnce: noop,
  on: noop,
  once: noop,
  removeHandler: noop,
  removeAllListeners: noop,
}

export const Menu = {
  buildFromTemplate: () => ({ items: [] }),
  setApplicationMenu: noop,
}

export class Tray {
  setToolTip = noop
  setContextMenu = noop
  setImage = noop
  on(): this {
    return this
  }
  destroy = noop
}

export const nativeImage = {
  createFromPath: () => ({ isEmpty: () => true, resize: () => ({}), setTemplateImage: noop }),
  createFromDataURL: () => ({ isEmpty: () => true, resize: () => ({}), setTemplateImage: noop }),
  createEmpty: () => ({ isEmpty: () => true, resize: () => ({}), setTemplateImage: noop }),
}

export const nativeTheme = {
  shouldUseDarkColors: false,
  themeSource: 'system' as const,
  on: noop,
}

export default { app, BrowserWindow, dialog, shell, ipcMain, Menu, Tray, nativeImage, nativeTheme }
