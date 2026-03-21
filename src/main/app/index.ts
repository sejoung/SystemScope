import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { createMainWindow, setForceQuit } from './createWindow'
import { registerAllIpc, cleanupSystemIpc } from '../ipc'
import { initializeRuntimeSettings } from './initializeRuntimeSettings'
import { startSnapshotScheduler, stopSnapshotScheduler } from '../services/growthAnalyzer'
import { ensureSnapshotDir } from '../services/snapshotStore'
import { getSettings } from '../store/settingsStore'
import { createTray, destroyTray } from './tray'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'

app.whenReady().then(() => {
  initializeRuntimeSettings()
  ensureSnapshotDir()
  registerAllIpc()
  const { snapshotIntervalMin } = getSettings()
  startSnapshotScheduler(snapshotIntervalMin * 60 * 1000)
  createTray()
  createMainWindow()

  app.on('activate', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
    } else {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  setForceQuit(true)
})

app.on('window-all-closed', () => {
  cleanupSystemIpc()
  stopSnapshotScheduler()
  destroyTray()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
