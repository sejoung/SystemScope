import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const access = vi.hoisted(() => vi.fn())
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

vi.mock('../../src/main/services/diskAnalyzer', () => ({
  scanFolder: vi.fn(),
  findLargeFiles: vi.fn(() => []),
  getExtensionBreakdown: vi.fn(() => [])
}))

vi.mock('../../src/main/services/quickScan', () => ({
  runQuickScan: vi.fn()
}))

vi.mock('../../src/main/services/userSpace', () => ({
  getUserSpaceInfo: vi.fn()
}))

vi.mock('../../src/main/services/diskInsights', () => ({
  findRecentGrowth: vi.fn(),
  findDuplicates: vi.fn()
}))

vi.mock('../../src/main/services/growthAnalyzer', () => ({
  analyzeGrowth: vi.fn()
}))

vi.mock('../../src/main/services/oldFileFinder', () => ({
  findOldFiles: vi.fn()
}))

vi.mock('../../src/main/jobs/jobManager', () => ({
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  sendJobProgress: vi.fn(),
  sendJobCompleted: vi.fn(),
  sendJobFailed: vi.fn()
}))

vi.mock('../../src/main/services/logging', () => ({
  logErrorAction: vi.fn(),
  logInfoAction: vi.fn(),
  logProductMetric: vi.fn()
}))

vi.mock('../../src/main/services/trashService', () => ({
  trashItemsWithConfirm: vi.fn()
}))

vi.mock('../../src/main/services/shellPathRegistry', () => ({
  registerShellPath,
  registerShellPaths: vi.fn()
}))

vi.mock('../../src/main/services/eventStore', () => ({
  recordEvent: vi.fn(),
  initEventStore: vi.fn(),
  stopEventStore: vi.fn()
}))

describe('registerDiskIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    access.mockReset()
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
})
