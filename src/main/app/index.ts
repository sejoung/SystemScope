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
const STARTUP_SNAPSHOT_DELAY_MS = 15_000
const STARTUP_UPDATE_CHECK_DELAY_MS = 8_000
const STARTUP_TRAY_REFRESH_DELAY_MS = 5_000

app.whenReady().then(() => {
  initializeLogging()
  initializeShutdownHandlers()
  initializeRuntimeSettings()
  registerAllIpc()

  if (!isE2ELightweight) {
    ensureSnapshotDir()
    const { snapshotIntervalMin } = getSettings()
    startSnapshotScheduler(snapshotIntervalMin * 60 * 1000, {
      initialDelayMs: STARTUP_SNAPSHOT_DELAY_MS
    })
    startUpdateChecker({
      initialDelayMs: STARTUP_UPDATE_CHECK_DELAY_MS
    })
    createTray({
      initialDelayMs: STARTUP_TRAY_REFRESH_DELAY_MS
    })
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
