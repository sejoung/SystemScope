import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import { createMainWindow } from './createWindow'
import { registerAllIpc, cleanupSystemIpc } from '../ipc'
import { initializeRuntimeSettings } from './initializeRuntimeSettings'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'

app.whenReady().then(() => {
  initializeRuntimeSettings()
  registerAllIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  cleanupSystemIpc()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
