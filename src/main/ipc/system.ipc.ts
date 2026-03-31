import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { SYSTEM_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'
import { getSystemStats } from '../services/systemMonitor'
import { checkAlerts } from '../services/alertManager'
import { recordEvent } from '../services/eventStore'
import { success, failure } from '@shared/types'
import { logErrorAction, logInfoAction } from '../services/logging'
import { tk } from '../i18n'
import {
  addSystemSubscriber,
  removeSystemSubscriber,
  hasSystemSubscribers,
  isSystemSubscriber,
  retainSystemSubscribers,
  resetSystemSubscribers
} from './systemSubscriptions'
import { getRequestMeta, withRequestMeta, type IpcRequestMetaArg } from './requestContext'

let updateTimer: ReturnType<typeof setTimeout> | null = null
let isRunning = false
let consecutiveFailures = 0
const MAX_BACKOFF_MS = 30_000

export function registerSystemIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATS, async (_event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    try {
      const stats = await getSystemStats()
      logInfoAction('system-ipc', 'stats.get', withRequestMeta(requestMeta))
      return success(stats)
    } catch (err) {
      logErrorAction('system-ipc', 'stats.get', withRequestMeta(requestMeta, { error: err }))
      return failure('UNKNOWN_ERROR', tk('main.system.error.fetch'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SUBSCRIBE, (event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!BrowserWindow.fromWebContents(event.sender)) {
      return failure('UNKNOWN_ERROR', 'Invalid sender')
    }
    addSystemSubscriber(event.sender.id)
    logInfoAction('system-ipc', 'realtime.subscribe', withRequestMeta(requestMeta, { senderId: event.sender.id }))
    startRealtimeUpdates()
    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE, (event, metaArg?: IpcRequestMetaArg) => {
    const requestMeta = getRequestMeta(metaArg)
    if (!BrowserWindow.fromWebContents(event.sender)) {
      return failure('UNKNOWN_ERROR', 'Invalid sender')
    }
    removeSystemSubscriber(event.sender.id)
    logInfoAction('system-ipc', 'realtime.unsubscribe', withRequestMeta(requestMeta, { senderId: event.sender.id }))
    if (!hasSystemSubscribers()) {
      stopRealtimeUpdates()
    }
    return success(true)
  })
}

function startRealtimeUpdates(): void {
  if (isRunning) return
  isRunning = true
  logInfoAction('system-ipc', 'realtime.start')
  void scheduleNextUpdate()
}

async function scheduleNextUpdate(): Promise<void> {
  if (!isRunning) return

  try {
    const stats = await getSystemStats()
    const wins = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed())
    retainSystemSubscribers(wins.map((win) => win.webContents.id))

    if (!hasSystemSubscribers()) {
      stopRealtimeUpdates()
      return
    }

    const subscriberWins = wins.filter((win) => isSystemSubscriber(win.webContents.id))

    for (const win of subscriberWins) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.EVENT_SYSTEM_UPDATE, stats)
      }
    }

    // 알림 체크
    const newAlerts = checkAlerts(stats)
    if (newAlerts.length > 0) {
      for (const alert of newAlerts) {
        void recordEvent(
          'alert',
          alert.severity === 'critical' ? 'error' : 'warning',
          alert.message,
          undefined,
          { alertId: alert.id, type: alert.type, value: alert.value, threshold: alert.threshold }
        )
      }
      for (const win of subscriberWins) {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.EVENT_ALERT_FIRED, newAlerts)
        }
      }
    }

    consecutiveFailures = 0
  } catch (err) {
    consecutiveFailures++
    logErrorAction('system-ipc', 'realtime.tick', { error: err, consecutiveFailures })
  }

  if (isRunning) {
    const backoff = Math.min(SYSTEM_UPDATE_INTERVAL_MS * 2 ** consecutiveFailures, MAX_BACKOFF_MS)
    updateTimer = setTimeout(() => { void scheduleNextUpdate() }, backoff)
  }
}

function stopRealtimeUpdates(): void {
  isRunning = false
  if (updateTimer) {
    clearTimeout(updateTimer)
    updateTimer = null
  }
  logInfoAction('system-ipc', 'realtime.stop')
}

export function cleanupSystemIpc(): void {
  stopRealtimeUpdates()
  resetSystemSubscribers()
}
