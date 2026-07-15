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
})
