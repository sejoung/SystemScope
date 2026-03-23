import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import { SYSTEM_UPDATE_INTERVAL_MS } from '@shared/constants/intervals'
import { getSystemStats } from '../services/systemMonitor'
import { checkAlerts } from '../services/alertManager'
import { success, failure } from '@shared/types'
import { logError } from '../services/logging'
import {
  addSystemSubscriber,
  removeSystemSubscriber,
  hasSystemSubscribers,
  isSystemSubscriber,
  retainSystemSubscribers,
  resetSystemSubscribers
} from './systemSubscriptions'

let updateTimer: ReturnType<typeof setTimeout> | null = null
let isRunning = false

export function registerSystemIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_STATS, async () => {
    try {
      const stats = await getSystemStats()
      return success(stats)
    } catch (err) {
      logError('system-ipc', '시스템 정보를 가져올 수 없습니다', err)
      return failure('UNKNOWN_ERROR', '시스템 정보를 가져올 수 없습니다.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SUBSCRIBE, (event) => {
    addSystemSubscriber(event.sender.id)
    startRealtimeUpdates()
    return success(true)
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE, (event) => {
    removeSystemSubscriber(event.sender.id)
    if (!hasSystemSubscribers()) {
      stopRealtimeUpdates()
    }
    return success(true)
  })
}

function startRealtimeUpdates(): void {
  if (isRunning) return
  isRunning = true
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
      for (const win of subscriberWins) {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.EVENT_ALERT_FIRED, newAlerts)
        }
      }
    }
  } catch (err) {
    logError('system-ipc', '실시간 업데이트 실패', err)
  }

  if (isRunning) {
    updateTimer = setTimeout(() => { void scheduleNextUpdate() }, SYSTEM_UPDATE_INTERVAL_MS)
  }
}

function stopRealtimeUpdates(): void {
  isRunning = false
  if (updateTimer) {
    clearTimeout(updateTimer)
    updateTimer = null
  }
}

export function cleanupSystemIpc(): void {
  stopRealtimeUpdates()
  resetSystemSubscribers()
}
