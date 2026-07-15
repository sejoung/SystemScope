import { beforeEach, describe, expect, it, vi } from 'vitest'

const appendBatch = vi.hoisted(() => vi.fn())
const getActiveProfile = vi.hoisted(() => vi.fn())
const getDirSizeEstimate = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/main/services/core/appendOnlyLogStore', () => ({
  AppendOnlyLogStore: class<T> {
    private entries: T[] = []
    async load(): Promise<T[]> { return [...this.entries] }
    async appendBatch(entries: T[]): Promise<void> {
      this.entries.push(...entries)
      appendBatch(entries)
    }
  },
}))

vi.mock('../../src/main/services/core/dataDir', () => ({
  getProjectMonitorFilePath: () => '/tmp/project-monitor.ndjson',
  getLegacyProjectMonitorFilePath: () => '/tmp/project-monitor.json',
}))

vi.mock('../../src/main/services/profile/profileManager', () => ({ getActiveProfile }))
vi.mock('../../src/main/utils/getDirSize', () => ({ getDirSizeEstimate }))
vi.mock('../../src/main/services/core/logging', () => ({ logInfo: vi.fn(), logWarn: vi.fn() }))
vi.mock('../../src/main/services/devtools/shellPathRegistry', () => ({ registerShellPaths: vi.fn() }))
vi.mock('../../src/main/services/history/eventStore', () => ({ recordEvent: vi.fn() }))

describe('project monitor performance guards', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.resetModules()
    appendBatch.mockReset()
    getActiveProfile.mockReset()
    getDirSizeEstimate.mockReset()
  })

  it('limits workspace scans and drains paths queued during an active refresh', async () => {
    const workspacePaths = Array.from({ length: 6 }, (_, index) => `/workspace/${index}`)
    getActiveProfile.mockReturnValue({ workspacePaths })
    let activeWorkspaceScans = 0
    let maxActiveWorkspaceScans = 0
    const scannedRoots: string[] = []
    getDirSizeEstimate.mockImplementation(async (targetPath: string, depth: number) => {
      if (depth === 3) {
        activeWorkspaceScans += 1
        maxActiveWorkspaceScans = Math.max(maxActiveWorkspaceScans, activeWorkspaceScans)
        scannedRoots.push(targetPath)
        await new Promise((resolve) => {
          setTimeout(resolve, 2)
        })
        activeWorkspaceScans -= 1
      }
      return 100
    })

    const { refreshProjectMonitor } = await import('../../src/main/services/projectMonitor/projectMonitor')
    const first = refreshProjectMonitor()
    const second = refreshProjectMonitor(['/workspace/queued'])
    await Promise.all([first, second])

    expect(maxActiveWorkspaceScans).toBeLessThanOrEqual(3)
    expect(scannedRoots.sort()).toEqual([...workspacePaths, '/workspace/queued'].sort())
    expect(appendBatch).toHaveBeenCalledTimes(2)
  })

  it('builds ordered workspace history from repeated scans', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100)
    getActiveProfile.mockReturnValue({ workspacePaths: ['/workspace/project'] })
    let scanSize = 100
    getDirSizeEstimate.mockImplementation(async (_targetPath: string, depth: number) => depth === 3 ? scanSize : 0)
    const { getProjectMonitorSummary, refreshProjectMonitor } = await import('../../src/main/services/projectMonitor/projectMonitor')

    await refreshProjectMonitor()
    scanSize = 250
    vi.setSystemTime(200)
    await refreshProjectMonitor()
    const summary = await getProjectMonitorSummary()

    expect(summary.workspaces).toHaveLength(1)
    expect(summary.workspaces[0]).toMatchObject({ currentSize: 250, previousSize: 100, recentGrowthBytes: 150 })
    expect(summary.workspaces[0].history.map((entry) => entry.size)).toEqual([100, 250])
    vi.useRealTimers()
  })
})
