import { BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { restoreWindowState, saveWindowState } from '../store/windowState'
import { getSettings } from '../store/settingsStore'
import { clearUnsavedSettingsState, getUnsavedSettingsState, setUnsavedSettingsState } from './rendererState'
import { tk } from '../i18n'

let forceQuit = false
let bypassUnsavedSettingsPrompt = false

export function setForceQuit(value: boolean): void {
  forceQuit = value
}

export function createMainWindow(): BrowserWindow {
  const saved = restoreWindowState()
  const { theme } = getSettings()
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  const isDevelopment = process.env.NODE_ENV === 'development' && Boolean(rendererUrl)

  const win = new BrowserWindow({
    width: saved?.width ?? 1440,
    height: saved?.height ?? 960,
    x: saved?.x,
    y: saved?.y,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: process.platform === 'win32',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: theme === 'light' ? '#f8fafc' : '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  win.once('ready-to-show', () => {
    if (saved?.isMaximized) {
      win.maximize()
    }
    win.show()
  })

  win.on('closed', () => {
    clearUnsavedSettingsState(win.webContents.id)
  })

  if (isDevelopment) {
    win.webContents.on('before-input-event', (_event, input) => {
      const isDevToolsShortcut =
        input.type === 'keyDown' &&
        (
          input.key === 'F12' ||
          (
            input.key.toLowerCase() === 'i' &&
            input.shift &&
            ((process.platform === 'darwin' && input.meta) || (process.platform !== 'darwin' && input.control))
          )
        )

      if (!isDevToolsShortcut) {
        return
      }

      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    })
  }

  // 창 닫기 시: 상태 저장 + 숨기기 (destroy하지 않음)
  // app.quit() 등 강제 종료 시에만 실제로 닫힘
  win.on('close', (e) => {
    saveWindowState(win)
    if (bypassUnsavedSettingsPrompt) {
      bypassUnsavedSettingsPrompt = false
      return
    }

    if (getUnsavedSettingsState(win.webContents.id)) {
      e.preventDefault()
      const response = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: [tk('window.unsaved.cancel'), tk('window.unsaved.discard')],
        defaultId: 0,
        cancelId: 0,
        title: tk('window.unsaved.title'),
        message: tk('window.unsaved.message'),
        detail: forceQuit
          ? tk('window.unsaved.quit_detail')
          : tk('window.unsaved.close_detail')
      })

      if (response === 0) {
        return
      }

      setUnsavedSettingsState(win.webContents.id, false)
      if (forceQuit) {
        bypassUnsavedSettingsPrompt = true
        win.close()
        return
      }

      win.hide()
      return
    }

    if (!forceQuit) {
      e.preventDefault()
      win.hide()
    }
  })

  if (isDevelopment) {
    win.loadURL(rendererUrl!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
