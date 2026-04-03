import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loads the persisted docker tab from localStorage and saves updates back', async () => {
    const getItem = vi.fn(() => 'images')
    const setItem = vi.fn()

    vi.stubGlobal('localStorage', {
      getItem,
      setItem,
    })

    const { useSettingsStore } = await import('../../src/renderer/src/stores/useSettingsStore')

    expect(useSettingsStore.getState().dockerTab).toBe('images')

    useSettingsStore.getState().setDockerTab('build-cache')

    expect(setItem).toHaveBeenCalledWith('systemscope.dockerTab', 'build-cache')
    expect(useSettingsStore.getState().dockerTab).toBe('build-cache')
  })

  it('falls back to overview when the persisted docker tab is invalid', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'invalid'),
      setItem: vi.fn(),
    })

    const { useSettingsStore } = await import('../../src/renderer/src/stores/useSettingsStore')

    expect(useSettingsStore.getState().dockerTab).toBe('overview')
  })
})
