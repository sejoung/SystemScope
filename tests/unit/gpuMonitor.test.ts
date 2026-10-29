import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ graphics: vi.fn(), platform: vi.fn() }))
vi.mock('systeminformation', () => ({ default: { graphics: mocks.graphics } }))
vi.mock('node:os', () => ({ platform: mocks.platform }))
vi.mock('../../src/main/services/core/logging', () => ({ logDebug: vi.fn(), logInfo: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.platform.mockReturnValue('darwin')
})
afterEach(() => vi.useRealTimers())

describe('GPU monitoring', () => {
  it('explains unavailable Apple Silicon metrics when fields are omitted', async () => {
    mocks.graphics.mockResolvedValue({ controllers: [{ model: 'Apple M1 Pro' }] })
    const { getCachedGpuInfo } = await import('../../src/main/services/system/gpuMonitor')
    expect(await getCachedGpuInfo()).toMatchObject({ available: true, usage: null, unavailableReason: 'apple_silicon' })
  })

  it('preserves measured zero values and rejects invalid values', async () => {
    mocks.graphics.mockResolvedValue({ controllers: [{ model: 'GPU', memoryUsed: 0, memoryTotal: 1024, utilizationGpu: -1, temperatureGpu: NaN }] })
    const { getCachedGpuInfo } = await import('../../src/main/services/system/gpuMonitor')
    expect(await getCachedGpuInfo()).toMatchObject({ memoryUsed: 0, memoryTotal: 1024 ** 3, usage: null, temperature: null })
  })

  it('keeps monitoring available when graphics collection rejects', async () => {
    mocks.graphics.mockRejectedValue(new Error('system_profiler failed'))
    const { getCachedGpuInfo } = await import('../../src/main/services/system/gpuMonitor')
    expect(await getCachedGpuInfo()).toMatchObject({ available: false, unavailableReason: 'metrics_unavailable' })
  })

  it('bounds a stuck graphics query, shares it, then retries after the cache expires', async () => {
    vi.useFakeTimers()
    mocks.graphics.mockReturnValueOnce(new Promise(() => {}))
    const { getCachedGpuInfo } = await import('../../src/main/services/system/gpuMonitor')
    const first = getCachedGpuInfo()
    const second = getCachedGpuInfo()
    await vi.advanceTimersByTimeAsync(5000)
    expect((await first).available).toBe(false)
    expect(await second).toEqual(await first)
    expect(mocks.graphics).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5001)
    mocks.graphics.mockResolvedValueOnce({ controllers: [{ model: 'Apple M1 Pro' }] })
    expect((await getCachedGpuInfo()).available).toBe(true)
  })
})
