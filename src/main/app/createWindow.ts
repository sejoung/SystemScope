import { BrowserWindow } from 'electron'
import { join } from 'path'
import { restoreWindowState, saveWindowState } from '../store/windowState'

let forceQuit = false

export function setForceQuit(value: boolean): void {
  forceQuit = value
}

export function createMainWindow(): BrowserWindow {
  const saved = restoreWindowState()

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
    backgroundColor: '#0f172a',
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

  // 창 닫기 시: 상태 저장 + 숨기기 (destroy하지 않음)
  // app.quit() 등 강제 종료 시에만 실제로 닫힘
  win.on('close', (e) => {
    saveWindowState(win)
    if (!forceQuit) {
      e.preventDefault()
      win.hide()
    }
  })

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
