import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { ShutdownPhase } from '@shared/types'
import { cleanupSystemIpc } from '../ipc'
import { destroyTray } from './tray'
import { cancelAllJobs, getActiveJobCount } from '../jobs/jobManager'
import { stopSnapshotScheduler, waitForPendingSnapshot } from '../services/growthAnalyzer'
import { logError, logInfo, shutdownLogging } from '../services/logging'
import { t } from '../i18n'

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
    logError('shutdown', 'Unhandled exception in main process', error)
    void handleProcessTermination('uncaughtException', 1)
  })

  // unhandledRejection은 로깅만 수행 (앱 종료하지 않음)
  process.on('unhandledRejection', (reason) => {
    logError('shutdown', 'Unhandled promise rejection in main process', {
      reason: reason instanceof Error ? reason : String(reason)
    })
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
  broadcastShutdownState('starting', t('SystemScope를 종료하는 중...'))
  logInfo('shutdown', 'Graceful shutdown started', {
    reason,
    activeJobs: getActiveJobCount()
  })

  broadcastShutdownState('cancelling_jobs', t('진행 중인 작업을 취소하는 중...'))
  cleanupSystemIpc()

  const cancelledJobs = cancelAllJobs()
  stopSnapshotScheduler()
  broadcastShutdownState('waiting_snapshot', t('스냅샷 작업 완료 대기 중...'))
  const snapshotFlushed = await waitForPendingSnapshot()
  broadcastShutdownState('cleaning_up', t('백그라운드 서비스를 정리하는 중...'))
  destroyTray()

  logInfo('shutdown', 'Graceful shutdown completed', {
    reason,
    cancelledJobs,
    snapshotFlushed
  })

  broadcastShutdownState('finishing', t('종료를 마무리하는 중...'))
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
