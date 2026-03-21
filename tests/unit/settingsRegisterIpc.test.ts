import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const setSettingsMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const validatePartialSettingsMock = vi.hoisted(() => vi.fn())
const restartSnapshotSchedulerMock = vi.hoisted(() => vi.fn())
const setThresholdsMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  dialog: {},
  shell: {},
  app: {
    getPath: vi.fn()
  },
  BrowserWindow: {}
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: getSettingsMock,
  setSettings: setSettingsMock
}))

vi.mock('../../src/main/store/settingsSchema', () => ({
  validatePartialSettings: validatePartialSettingsMock
}))

vi.mock('../../src/main/services/growthAnalyzer', () => ({
  restartSnapshotScheduler: restartSnapshotSchedulerMock
}))

vi.mock('../../src/main/services/alertManager', () => ({
  setThresholds: setThresholdsMock
}))

describe('registerSettingsIpc', () => {
  beforeEach(() => {
    handlers.clear()
    setSettingsMock.mockReset()
    getSettingsMock.mockReset()
    validatePartialSettingsMock.mockReset()
    restartSnapshotSchedulerMock.mockReset()
    setThresholdsMock.mockReset()
  })

  it('should apply thresholds to runtime alert state when saving settings', async () => {
    validatePartialSettingsMock.mockReturnValue(true)
    getSettingsMock.mockReturnValue({
      thresholds: {
        diskWarning: 70,
        diskCritical: 85,
        memoryWarning: 75,
        memoryCritical: 88,
        gpuMemoryWarning: 65,
        gpuMemoryCritical: 80
      },
      theme: 'light',
      snapshotIntervalMin: 30
    })

    const { registerSettingsIpc } = await import('../../src/main/ipc/settings.ipc')
    registerSettingsIpc()

    const handler = handlers.get(IPC_CHANNELS.SETTINGS_SET)
    expect(handler).toBeTypeOf('function')

    const payload = {
      thresholds: {
        diskWarning: 70,
        diskCritical: 85,
        memoryWarning: 75,
        memoryCritical: 88,
        gpuMemoryWarning: 65,
        gpuMemoryCritical: 80
      },
      theme: 'light',
      snapshotIntervalMin: 30
    }
    const result = handler?.({}, payload) as { ok: boolean }

    expect(setSettingsMock).toHaveBeenCalledWith(payload)
    expect(setThresholdsMock).toHaveBeenCalledWith(payload.thresholds)
    expect(restartSnapshotSchedulerMock).toHaveBeenCalledWith(30 * 60 * 1000)
    expect(result.ok).toBe(true)
  })
})
