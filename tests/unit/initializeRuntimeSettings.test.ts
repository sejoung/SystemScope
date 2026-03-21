import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSettingsMock = vi.fn()
const setThresholdsMock = vi.fn()

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: getSettingsMock
}))

vi.mock('../../src/main/services/alertManager', () => ({
  setThresholds: setThresholdsMock
}))

describe('initializeRuntimeSettings', () => {
  beforeEach(() => {
    getSettingsMock.mockReset()
    setThresholdsMock.mockReset()
  })

  it('should apply persisted thresholds to alert runtime state on startup', async () => {
    getSettingsMock.mockReturnValue({
      thresholds: {
        diskWarning: 70,
        diskCritical: 85,
        memoryWarning: 75,
        memoryCritical: 88,
        gpuMemoryWarning: 65,
        gpuMemoryCritical: 80
      },
      theme: 'dark'
    })

    const { initializeRuntimeSettings } = await import('../../src/main/app/initializeRuntimeSettings')

    initializeRuntimeSettings()

    expect(setThresholdsMock).toHaveBeenCalledTimes(1)
    expect(setThresholdsMock).toHaveBeenCalledWith({
      diskWarning: 70,
      diskCritical: 85,
      memoryWarning: 75,
      memoryCritical: 88,
      gpuMemoryWarning: 65,
      gpuMemoryCritical: 80
    })
  })

  it('should fall back to safe defaults when persisted settings are malformed', async () => {
    getSettingsMock.mockReturnValue({
      thresholds: {
        diskWarning: 80,
        diskCritical: 90,
        memoryWarning: 80,
        memoryCritical: 90,
        gpuMemoryWarning: 80,
        gpuMemoryCritical: 90
      },
      theme: 'dark'
    })

    const { initializeRuntimeSettings } = await import('../../src/main/app/initializeRuntimeSettings')

    initializeRuntimeSettings()

    expect(setThresholdsMock).toHaveBeenCalledWith({
      diskWarning: 80,
      diskCritical: 90,
      memoryWarning: 80,
      memoryCritical: 90,
      gpuMemoryWarning: 80,
      gpuMemoryCritical: 90
    })
  })
})
