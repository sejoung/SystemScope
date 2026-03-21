import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { createMainWindow } from './createWindow'
import { registerAllIpc, cleanupSystemIpc } from '../ipc'
import { initializeRuntimeSettings } from './initializeRuntimeSettings'
import { startSnapshotScheduler, stopSnapshotScheduler } from '../services/growthAnalyzer'
import { ensureSnapshotDir } from '../services/snapshotStore'
import { getSettings } from '../store/settingsStore'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'

app.whenReady().then(() => {
  initializeRuntimeSettings()
  ensureSnapshotDir()
  registerAllIpc()
  const { snapshotIntervalMin } = getSettings()
  startSnapshotScheduler(snapshotIntervalMin * 60 * 1000)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  cleanupSystemIpc()
  stopSnapshotScheduler()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
