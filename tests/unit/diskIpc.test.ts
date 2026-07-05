import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const access = vi.hoisted(() => vi.fn())
const findDuplicatesMock = vi.hoisted(() => vi.fn())
const registerShellPath = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('fs/promises', () => ({
  default: {},
  access,
  constants: { R_OK: 4 }
}))

vi.mock('../../src/main/services/disk/diskAnalyzer', () => ({
  scanFolder: vi.fn(),
  findLargeFiles: vi.fn(() => []),
  getExtensionBreakdown: vi.fn(() => [])
}))

vi.mock('../../src/main/services/disk/quickScan', () => ({
  runQuickScan: vi.fn()
}))

vi.mock('../../src/main/services/disk/userSpace', () => ({
  getUserSpaceInfo: vi.fn()
}))

vi.mock('../../src/main/services/disk/diskInsights', () => ({
  findRecentGrowth: vi.fn(),
  findDuplicates: findDuplicatesMock
}))

vi.mock('../../src/main/services/disk/growthAnalyzer', () => ({
  analyzeGrowth: vi.fn()
}))

vi.mock('../../src/main/services/disk/oldFileFinder', () => ({
  findOldFiles: vi.fn()
}))

vi.mock('../../src/main/jobs/jobManager', () => ({
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  sendJobProgress: vi.fn(),
  sendJobCompleted: vi.fn(),
  sendJobFailed: vi.fn()
}))

vi.mock('../../src/main/services/core/logging', () => ({
  logErrorAction: vi.fn(),
  logInfoAction: vi.fn(),
  logProductMetric: vi.fn()
}))

vi.mock('../../src/main/services/core/trashService', () => ({
  trashItemsWithConfirm: vi.fn()
}))

vi.mock('../../src/main/services/devtools/shellPathRegistry', () => ({
  registerShellPath,
  registerShellPaths: vi.fn()
}))

vi.mock('../../src/main/services/history/eventStore', () => ({
  recordEvent: vi.fn(),
  initEventStore: vi.fn(),
  stopEventStore: vi.fn()
}))

describe('registerDiskIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    access.mockReset()
    findDuplicatesMock.mockReset()
    registerShellPath.mockReset()
  })

  it('does not register shell access for unreadable scan targets', async () => {
    access.mockRejectedValue(new Error('access denied'))

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_SCAN_FOLDER)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, '/restricted/path') as { ok: boolean; error?: { code: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('PERMISSION_DENIED')
    expect(registerShellPath).not.toHaveBeenCalled()
  })

  it('does not issue a deletion key for the kept duplicate file', async () => {
    access.mockResolvedValue(undefined)
    findDuplicatesMock.mockResolvedValue([
      {
        hash: 'same-content',
        size: 100,
        totalWaste: 100,
        files: [
          { name: 'keep.bin', path: '/tmp/keep.bin', modified: 1 },
          { name: 'copy.bin', path: '/tmp/copy.bin', modified: 2 }
        ]
      }
    ])

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_FIND_DUPLICATES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, '/tmp', 100) as {
      ok: boolean
      data?: Array<{ files: Array<{ path: string; deletionKey?: string }> }>
    }

    expect(result.ok).toBe(true)
    expect(result.data?.[0]?.files[0]).toMatchObject({ path: '/tmp/keep.bin' })
    expect(result.data?.[0]?.files[0]?.deletionKey).toBeUndefined()
    expect(result.data?.[0]?.files[1]?.deletionKey).toEqual(expect.any(String))
  })
})
