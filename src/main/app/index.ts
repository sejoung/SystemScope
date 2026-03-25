import { app, BrowserWindow } from 'electron'
import { createMainWindow, setForceQuit } from './createWindow'
import { registerAllIpc } from '../ipc'
import { initializeRuntimeSettings } from './initializeRuntimeSettings'
import { startSnapshotScheduler } from '../services/growthAnalyzer'
import { ensureSnapshotDir } from '../services/snapshotStore'
import { getSettings } from '../store/settingsStore'
import { createTray } from './tray'
import { initializeLogging, logError } from '../services/logging'
import { executeGracefulShutdown, initializeShutdownHandlers, markQuitAfterShutdown } from './shutdown'
import { startUpdateChecker, stopUpdateChecker } from '../services/updateChecker'

let appReadyForQuit = false

const isE2ELightweight = process.env.E2E_LIGHTWEIGHT === '1'

app.whenReady().then(() => {
  initializeLogging()
  initializeShutdownHandlers()
  initializeRuntimeSettings()
  registerAllIpc()

  if (!isE2ELightweight) {
    ensureSnapshotDir()
    const { snapshotIntervalMin } = getSettings()
    startSnapshotScheduler(snapshotIntervalMin * 60 * 1000)
    startUpdateChecker()
    createTray()
  }

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
}).catch((err) => {
  logError('app', 'App initialization failed', err)
  app.quit()
})

app.on('before-quit', (event) => {
  stopUpdateChecker()
  if (!appReadyForQuit) {
    event.preventDefault()
    appReadyForQuit = true
    markQuitAfterShutdown()
    void executeGracefulShutdown('before-quit').finally(() => {
      app.quit()
    })
    return
  }

  setForceQuit(true)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
