import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const schedulerCalls = vi.hoisted(() => [] as number[])
const setThresholdsMock = vi.hoisted(() => vi.fn())
const setSettingsMock = vi.hoisted(() => vi.fn())
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
  locale: 'ko' as 'ko' | 'en',
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
    getPath: vi.fn((name: string) => (name === 'userData' ? '/tmp/systemscope-test' : '/Users/test'))
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => ({ ...storeState }),
  setSettings: setSettingsMock
}))

vi.mock('../../src/main/services/growthAnalyzer', () => ({
  restartSnapshotScheduler: (intervalMs: number) => {
    schedulerCalls.push(intervalMs)
  }
}))

vi.mock('../../src/main/services/alertManager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/main/services/alertManager')>()
  return {
    ...actual,
    setThresholds: setThresholdsMock
  }
})

describe('settings validation integration', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    schedulerCalls.length = 0
    setThresholdsMock.mockReset()
    setSettingsMock.mockReset()
  })

  it('should reject invalid settings payloads without mutating runtime state or scheduler', async () => {
    const { registerSettingsIpc } = await import('../../src/main/ipc/settings.ipc')
    registerSettingsIpc()

    const setHandler = handlers.get(IPC_CHANNELS.SETTINGS_SET)
    expect(setHandler).toBeTypeOf('function')

    const result = setHandler?.({}, {
      thresholds: {
        diskWarning: 70,
        invalidField: 123
      }
    }) as { ok: boolean; error?: { code: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_INPUT')
    expect(setSettingsMock).not.toHaveBeenCalled()
    expect(setThresholdsMock).not.toHaveBeenCalled()
    expect(schedulerCalls).toEqual([])
  })
})
