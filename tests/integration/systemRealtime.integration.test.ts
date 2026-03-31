import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'
import { SYSTEM_UPDATE_INTERVAL_MS } from '../../src/shared/constants/intervals'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const getSystemStatsMock = vi.hoisted(() => vi.fn())
const checkAlertsMock = vi.hoisted(() => vi.fn())

const subscriberWindow = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: {
    id: 11,
    send: vi.fn(),
    isDestroyed: vi.fn(() => false)
  }
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [subscriberWindow]),
    fromWebContents: vi.fn(() => subscriberWindow)
  }
}))

vi.mock('../../src/main/services/systemMonitor', () => ({
  getSystemStats: getSystemStatsMock
}))

vi.mock('../../src/main/services/alertManager', () => ({
  checkAlerts: checkAlertsMock
}))

vi.mock('../../src/main/services/eventStore', () => ({
  recordEvent: vi.fn(),
  initEventStore: vi.fn(),
  stopEventStore: vi.fn()
}))

vi.mock('../../src/main/services/metricsStore', () => ({
  collectMetricPoint: vi.fn(() => Promise.resolve()),
  initMetricsStore: vi.fn(),
  stopMetricsStore: vi.fn()
}))

describe('system realtime integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    handlers.clear()
    getSystemStatsMock.mockReset()
    checkAlertsMock.mockReset()
    subscriberWindow.isDestroyed.mockReset()
    subscriberWindow.isDestroyed.mockReturnValue(false)
    subscriberWindow.webContents.isDestroyed.mockReset()
    subscriberWindow.webContents.isDestroyed.mockReturnValue(false)
    subscriberWindow.webContents.send.mockReset()
  })

  it('should publish system updates and alerts only while subscribed', async () => {
    const stats = {
      cpu: { usage: 10, cores: [10], temperature: null, model: 'test', speed: 3.2 },
      memory: { total: 100, used: 60, active: 60, available: 40, cached: 0, usage: 60, swapTotal: 0, swapUsed: 0 },
      gpu: { available: false, model: null, usage: null, memoryTotal: null, memoryUsed: null, temperature: null, unavailableReason: null },
      disk: { drives: [{ fs: '/', type: 'apfs', size: 1000, used: 600, available: 400, usage: 60, mount: '/', purgeable: null, realUsage: 60 }] },
      timestamp: 1
    }
    const alerts = [{ id: 'a-1', type: 'memory', severity: 'warning', message: 'warn', value: 60, threshold: 50, timestamp: 1, dismissed: false }]

    getSystemStatsMock.mockResolvedValue(stats)
    checkAlertsMock.mockReturnValue(alerts)

    const { registerSystemIpc, cleanupSystemIpc } = await import('../../src/main/ipc/system.ipc')
    registerSystemIpc()

    const subscribeHandler = handlers.get(IPC_CHANNELS.SYSTEM_SUBSCRIBE)
    const unsubscribeHandler = handlers.get(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE)

    expect(subscribeHandler).toBeTypeOf('function')
    subscribeHandler?.({ sender: { id: 11 } })

    await vi.advanceTimersByTimeAsync(SYSTEM_UPDATE_INTERVAL_MS)

    expect(subscriberWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.EVENT_SYSTEM_UPDATE, stats)
    expect(subscriberWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.EVENT_ALERT_FIRED, alerts)

    subscriberWindow.webContents.send.mockClear()
    unsubscribeHandler?.({ sender: { id: 11 } })
    await vi.advanceTimersByTimeAsync(SYSTEM_UPDATE_INTERVAL_MS)

    expect(subscriberWindow.webContents.send).not.toHaveBeenCalled()

    cleanupSystemIpc()
    vi.useRealTimers()
  })
})
