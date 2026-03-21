import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const schedulerCalls = vi.hoisted(() => [] as number[])
const storeState = vi.hoisted(() => ({
  thresholds: {
    diskWarning: 80,
    diskCritical: 90,
    memoryWarning: 80,
    memoryCritical: 90,
    gpuMemoryWarning: 80,
    gpuMemoryCritical: 90
  },
  theme: 'dark' as 'dark' | 'light',
  snapshotIntervalMin: 60
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  dialog: {},
  shell: {},
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/systemscope-test'
      if (name === 'home') return '/Users/test'
      return '/tmp'
    })
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => ({ ...storeState }),
  setSettings: (settings: Partial<typeof storeState>) => {
    if (settings.thresholds) storeState.thresholds = settings.thresholds
    if (settings.theme) storeState.theme = settings.theme
    if (settings.snapshotIntervalMin) storeState.snapshotIntervalMin = settings.snapshotIntervalMin
  }
}))

vi.mock('../../src/main/services/growthAnalyzer', () => ({
  restartSnapshotScheduler: (intervalMs: number) => {
    schedulerCalls.push(intervalMs)
  }
}))

describe('settings flow integration', () => {
  beforeEach(() => {
    handlers.clear()
    schedulerCalls.length = 0
    storeState.thresholds = {
      diskWarning: 80,
      diskCritical: 90,
      memoryWarning: 80,
      memoryCritical: 90,
      gpuMemoryWarning: 80,
      gpuMemoryCritical: 90
    }
    storeState.theme = 'dark'
    storeState.snapshotIntervalMin = 60
  })

  it('should persist settings and update runtime thresholds through settings:set', async () => {
    const { registerSettingsIpc } = await import('../../src/main/ipc/settings.ipc')
    const { checkAlerts, resetAlertState } = await import('../../src/main/services/alertManager')

    resetAlertState()
    registerSettingsIpc()

    const setHandler = handlers.get(IPC_CHANNELS.SETTINGS_SET)
    const getHandler = handlers.get(IPC_CHANNELS.SETTINGS_GET)

    expect(setHandler).toBeTypeOf('function')
    expect(getHandler).toBeTypeOf('function')

    const payload = {
      thresholds: {
        diskWarning: 70,
        diskCritical: 85,
        memoryWarning: 75,
        memoryCritical: 88,
        gpuMemoryWarning: 65,
        gpuMemoryCritical: 80
      },
      theme: 'light' as const,
      snapshotIntervalMin: 30 as const
    }

    const setResult = setHandler?.({}, payload) as { ok: boolean; data?: unknown }
    const getResult = getHandler?.({}, undefined) as { ok: boolean; data?: unknown }

    expect(setResult.ok).toBe(true)
    expect(getResult.ok).toBe(true)
    expect(getResult.data).toEqual(payload)
    const alerts = checkAlerts({
      cpu: { usage: 10, cores: [10], temperature: null, model: 'Test CPU', speed: 3.0 },
      memory: {
        total: 16_000_000_000,
        used: 2_000_000_000,
        active: 2_000_000_000,
        available: 14_000_000_000,
        cached: 0,
        usage: 10,
        swapTotal: 0,
        swapUsed: 0
      },
      gpu: {
        available: false,
        model: 'Test GPU',
        usage: null,
        memoryTotal: null,
        memoryUsed: null,
        temperature: null
      },
      disk: {
        drives: [{
          fs: '/dev/disk1s1',
          type: 'apfs',
          size: 100,
          used: 72,
          available: 28,
          usage: 72,
          mount: '/',
          purgeable: null,
          realUsage: null
        }]
      },
      timestamp: Date.now()
    })
    expect(alerts.some((alert) => alert.type === 'disk' && alert.severity === 'warning' && alert.threshold === payload.thresholds.diskWarning)).toBe(true)
    expect(schedulerCalls).toEqual([30 * 60 * 1000])
  })
})
