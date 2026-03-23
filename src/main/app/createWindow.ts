import { BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { restoreWindowState, saveWindowState } from '../store/windowState'
import { getSettings } from '../store/settingsStore'
import { getUnsavedSettingsState, setUnsavedSettingsState } from './rendererState'
import { t } from '../i18n'

let forceQuit = false
let bypassUnsavedSettingsPrompt = false

export function setForceQuit(value: boolean): void {
  forceQuit = value
}

export function createMainWindow(): BrowserWindow {
  const saved = restoreWindowState()
  const { theme } = getSettings()

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

  // 창 닫기 시: 상태 저장 + 숨기기 (destroy하지 않음)
  // app.quit() 등 강제 종료 시에만 실제로 닫힘
  win.on('close', (e) => {
    saveWindowState(win)
    if (bypassUnsavedSettingsPrompt) {
      bypassUnsavedSettingsPrompt = false
      return
    }

    if (getUnsavedSettingsState()) {
      e.preventDefault()
      const response = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: [t('Cancel'), t('Discard Changes')],
        defaultId: 0,
        cancelId: 0,
        title: t('Unsaved Settings'),
        message: t('저장하지 않은 설정 변경사항이 있습니다.'),
        detail: forceQuit
          ? t('저장하지 않고 앱을 종료하시겠습니까?')
          : t('저장하지 않고 창을 닫으면 변경사항이 사라집니다.')
      })

      if (response === 0) {
        return
      }

      setUnsavedSettingsState(false)
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

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
