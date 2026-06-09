import { app, BrowserWindow } from 'electron'
import { createMainWindow, setForceQuit } from './createWindow'
import { registerAllIpc } from '../ipc'
import { initializeRuntimeSettings } from './initializeRuntimeSettings'
import { startSnapshotScheduler } from '@main/services/disk'
import { ensureSnapshotDir } from '@main/services/history'
import { getSettings } from '../store/settingsStore'
import { createTray } from './tray'
import { initializeLogging, logError } from '@main/services/core'
import { executeGracefulShutdown, initializeShutdownHandlers, markQuitAfterShutdown } from './shutdown'
import { startUpdateChecker, stopUpdateChecker } from '@main/services/update'
import { startJobPruner, stopJobPruner } from '../jobs/jobManager'
import { initEventStore } from '@main/services/history'
import { initMetricsStore, stopMetricsStore } from '@main/services/history'
import { initDiagnosisAdvisor, stopDiagnosisAdvisor } from '@main/services/diagnosis'
import { initAlertHistory, stopAlertHistory } from '@main/services/alerts'
import { initCleanupInbox } from '@main/services/cleanup'
import { initAutomationScheduler, stopAutomationScheduler } from '@main/services/cleanup'
import { initProjectMonitor, stopProjectMonitor } from '@main/services/projectMonitor'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

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
    void initEventStore()
    void initMetricsStore()
    void initDiagnosisAdvisor()
    void initAlertHistory()
    void initCleanupInbox()
    initAutomationScheduler()
    initProjectMonitor()

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
      startJobPruner()
    }

    const mainWindow = createMainWindow()

    app.on('activate', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
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
    stopJobPruner()
    stopMetricsStore()
    stopDiagnosisAdvisor()
    stopAlertHistory()
    stopAutomationScheduler()
    stopProjectMonitor()
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
}
