import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { ShutdownPhase } from '@shared/types'
import { cleanupSystemIpc } from '../ipc'
import { destroyTray } from './tray'
import { cancelAllJobs, getActiveJobCount } from '../jobs/jobManager'
import { stopSnapshotScheduler, waitForPendingSnapshot } from '../services/growthAnalyzer'
import { logError, logInfo, shutdownLogging } from '../services/logging'

let shutdownPromise: Promise<void> | null = null
let shutdownCompleted = false
let quitAfterShutdown = false

export function initializeShutdownHandlers(): void {
  process.once('SIGINT', () => {
    void handleProcessTermination('SIGINT', 130)
  })

  process.once('SIGTERM', () => {
    void handleProcessTermination('SIGTERM', 143)
  })

  process.once('uncaughtException', (error) => {
    logError('shutdown', 'Uncaught exception in main process', error)
    void handleProcessTermination('uncaughtException', 1)
  })

  process.once('unhandledRejection', (reason) => {
    logError('shutdown', 'Unhandled rejection in main process', {
      reason: reason instanceof Error ? reason : String(reason)
    })
    void handleProcessTermination('unhandledRejection', 1)
  })
}

export function markQuitAfterShutdown(): void {
  quitAfterShutdown = true
}

export async function executeGracefulShutdown(reason: string): Promise<void> {
  if (shutdownCompleted) {
    return
  }

  if (!shutdownPromise) {
    shutdownPromise = doGracefulShutdown(reason)
      .catch((error) => {
        logError('shutdown', 'Graceful shutdown failed', { reason, error })
      })
      .finally(() => {
        shutdownCompleted = true
        shutdownPromise = null
      })
  }

  await shutdownPromise
}

async function doGracefulShutdown(reason: string): Promise<void> {
  broadcastShutdownState('starting', 'Shutting down SystemScope...')
  logInfo('shutdown', 'Starting graceful shutdown', {
    reason,
    activeJobs: getActiveJobCount()
  })

  broadcastShutdownState('cancelling_jobs', 'Cancelling active jobs...')
  cleanupSystemIpc()

  const cancelledJobs = cancelAllJobs()
  stopSnapshotScheduler()
  broadcastShutdownState('waiting_snapshot', 'Waiting for snapshot tasks to finish...')
  const snapshotFlushed = await waitForPendingSnapshot()
  broadcastShutdownState('cleaning_up', 'Cleaning up background services...')
  destroyTray()

  logInfo('shutdown', 'Graceful shutdown completed', {
    reason,
    cancelledJobs,
    snapshotFlushed
  })

  broadcastShutdownState('finishing', 'Finalizing shutdown...')
  shutdownLogging()
}

function broadcastShutdownState(phase: ShutdownPhase, message: string): void {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed() && !win.webContents.isDestroyed())
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.EVENT_SHUTDOWN_STATE, { phase, message })
  }
}

async function handleProcessTermination(reason: string, exitCode: number): Promise<void> {
  await executeGracefulShutdown(reason)

  if (app.isReady() && !quitAfterShutdown) {
    app.exit(exitCode)
    return
  }

  process.exit(exitCode)
}
