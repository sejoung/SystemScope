import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentLoad: vi.fn(), cpu: vi.fn(), mem: vi.fn(), fsSize: vi.fn(), disksIO: vi.fn(),
  command: vi.fn(),
}))
vi.mock('systeminformation', () => ({ default: mocks }))
vi.mock('node:os', () => ({ platform: () => 'darwin' }))
vi.mock('../../src/main/services/core/externalCommand', () => ({
  runExternalCommand: mocks.command, isExternalCommandError: () => false,
}))
vi.mock('../../src/main/services/core/logging', () => ({ logDebug: vi.fn(), logWarn: vi.fn() }))
vi.mock('../../src/main/services/system/gpuMonitor', () => ({
  getCachedGpuInfo: vi.fn().mockResolvedValue({ available: false }),
}))
vi.mock('../../src/main/services/system/networkMonitor', () => ({
  getNetworkInfo: vi.fn().mockResolvedValue({ interfaces: [] }),
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.currentLoad.mockResolvedValue({ currentLoad: 10, cpus: [{ load: 10 }] })
  mocks.cpu.mockResolvedValue({ manufacturer: 'Apple', brand: 'M1 Pro', speed: 2.4 })
  mocks.mem.mockResolvedValue({ total: 100, available: 40, used: 80, active: 60, swaptotal: 0, swapused: 0 })
  mocks.disksIO.mockResolvedValue(null)
  mocks.fsSize.mockResolvedValue([
    { fs: '/dev/disk3s1s1', type: 'APFS', size: 1000, used: 30, available: 100, use: 23.08, mount: '/' },
    { fs: '/dev/disk3s5', type: 'APFS', size: 1000, used: 850, available: 100, use: 89.47, mount: '/System/Volumes/Data' },
  ])
})

describe('system stats on macOS', () => {
  it('reports occupied container space instead of labelling user data as purgeable', async () => {
    mocks.command.mockResolvedValue({ stdout: '<key>APFSContainerSize</key><integer>1000</integer><key>APFSContainerFree</key><integer>100</integer>' })
    const { getSystemStats } = await import('../../src/main/services/system/systemMonitor')
    const stats = await getSystemStats()
    expect(stats.disk.drives[0]).toMatchObject({ size: 1000, used: 900, available: 100, usage: 90, realUsage: 90, purgeable: null })
    expect(stats.disk.drives[1]).toMatchObject({ used: 850, realUsage: null, purgeable: null })
    expect(stats.memory.usage).toBe(60)
    expect(mocks.command).toHaveBeenCalledWith('/usr/sbin/diskutil', ['info', '-plist', '/'], { timeout: 5_000 })
  })

  it('uses filesystem data if diskutil returns invalid container capacity', async () => {
    mocks.command.mockResolvedValue({ stdout: '<key>APFSContainerSize</key><integer>0</integer><key>APFSContainerFree</key><integer>100</integer>' })
    const { getSystemStats } = await import('../../src/main/services/system/systemMonitor')
    const stats = await getSystemStats()
    expect(stats.disk.drives[0]).toMatchObject({ used: 30, realUsage: null, usage: 23.08 })
  })

  it('still returns CPU and memory stats when APFS information is unavailable', async () => {
    mocks.command.mockRejectedValue(new Error('permission denied'))
    const { getSystemStats } = await import('../../src/main/services/system/systemMonitor')
    expect(await getSystemStats()).toMatchObject({ cpu: { usage: 10 }, memory: { usage: 60 } })
  })
})
