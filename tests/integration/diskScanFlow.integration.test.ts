import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const scanFolderMock = vi.hoisted(() => vi.fn())
const findLargeFilesMock = vi.hoisted(() => vi.fn())
const getExtensionBreakdownMock = vi.hoisted(() => vi.fn())
const focusedWindow = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
    isDestroyed: vi.fn(() => false)
  }
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => focusedWindow),
    getAllWindows: vi.fn(() => [focusedWindow])
  }
}))

vi.mock('fs/promises', () => ({
  default: {},
  access: vi.fn(() => Promise.resolve()),
  constants: { R_OK: 4 }
}))

vi.mock('../../src/main/services/diskAnalyzer', () => ({
  scanFolder: scanFolderMock,
  findLargeFiles: findLargeFilesMock,
  getExtensionBreakdown: getExtensionBreakdownMock
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

describe('disk scan flow integration', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    scanFolderMock.mockReset()
    findLargeFilesMock.mockReset()
    getExtensionBreakdownMock.mockReset()
    focusedWindow.webContents.send.mockReset()
  })

  it('should run scan job, emit progress/completion, and reuse cached scan result for insights', async () => {
    let progressCallback: ((current: string, fileCount: number) => void) | null = null
    let resolveScan: ((value: unknown) => void) | null = null

    scanFolderMock.mockImplementation((_path: string, onProgress?: (current: string, fileCount: number) => void) => {
      progressCallback = onProgress ?? null
      return new Promise((resolve) => {
        resolveScan = resolve
      })
    })

    const scanResult = {
      rootPath: '/Users/test/Downloads',
      tree: {
        name: 'Downloads',
        path: '/Users/test/Downloads',
        size: 300,
        children: [],
        isFile: false
      },
      totalSize: 300,
      fileCount: 3,
      folderCount: 1,
      scanDuration: 1500
    }

    findLargeFilesMock.mockReturnValue([{ name: 'large.zip', path: '/Users/test/Downloads/large.zip', size: 200, modified: 1 }])
    getExtensionBreakdownMock.mockReturnValue([{ extension: '.zip', totalSize: 200, count: 1 }])

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const scanHandler = handlers.get(IPC_CHANNELS.DISK_SCAN_FOLDER)
    const largeFilesHandler = handlers.get(IPC_CHANNELS.DISK_GET_LARGE_FILES)
    const extensionsHandler = handlers.get(IPC_CHANNELS.DISK_GET_EXTENSIONS)

    expect(scanHandler).toBeTypeOf('function')
    expect(largeFilesHandler).toBeTypeOf('function')
    expect(extensionsHandler).toBeTypeOf('function')

    const startResult = await scanHandler!({}, '/Users/test/Downloads') as { ok: boolean; data?: { jobId: string } }
    expect(startResult.ok).toBe(true)
    expect(startResult.data?.jobId).toBeDefined()
    expect(progressCallback).not.toBeNull()
    expect(resolveScan).not.toBeNull()

    progressCallback!('/Users/test/Downloads/file-a', 2)
    expect(focusedWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.JOB_PROGRESS,
      expect.objectContaining({
        id: startResult.data?.jobId,
        currentStep: 'Scanning: file-a (2 files)'
      })
    )

    resolveScan!(scanResult)
    await Promise.resolve()

    expect(focusedWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.JOB_COMPLETED,
      expect.objectContaining({
        id: startResult.data?.jobId,
        data: scanResult
      })
    )

    const largeFilesResult = await largeFilesHandler!({}, '/Users/test/Downloads', 50) as { ok: boolean; data?: unknown }
    const extensionsResult = await extensionsHandler!({}, '/Users/test/Downloads') as { ok: boolean; data?: unknown }

    expect(largeFilesResult.ok).toBe(true)
    expect(extensionsResult.ok).toBe(true)
    expect(scanFolderMock).toHaveBeenCalledTimes(1)
    expect(findLargeFilesMock).toHaveBeenCalledWith(scanResult.tree, 50)
    expect(getExtensionBreakdownMock).toHaveBeenCalledWith(scanResult.tree)
  })

  it('should invalidate cached scan results and force a fresh scan for follow-up insights', async () => {
    const firstScanResult = {
      rootPath: '/Users/test/Downloads',
      tree: {
        name: 'Downloads',
        path: '/Users/test/Downloads',
        size: 300,
        children: [],
        isFile: false
      },
      totalSize: 300,
      fileCount: 3,
      folderCount: 1,
      scanDuration: 1000
    }

    const refreshedScanResult = {
      rootPath: '/Users/test/Downloads',
      tree: {
        name: 'Downloads',
        path: '/Users/test/Downloads',
        size: 120,
        children: [],
        isFile: false
      },
      totalSize: 120,
      fileCount: 1,
      folderCount: 1,
      scanDuration: 900
    }

    scanFolderMock
      .mockResolvedValueOnce(firstScanResult)
      .mockResolvedValueOnce(refreshedScanResult)

    findLargeFilesMock
      .mockReturnValueOnce([{ name: 'before.zip', path: '/Users/test/Downloads/before.zip', size: 200, modified: 1 }])
      .mockReturnValueOnce([{ name: 'after.zip', path: '/Users/test/Downloads/after.zip', size: 120, modified: 2 }])

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const largeFilesHandler = handlers.get(IPC_CHANNELS.DISK_GET_LARGE_FILES)
    const invalidateHandler = handlers.get(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE)

    expect(largeFilesHandler).toBeTypeOf('function')
    expect(invalidateHandler).toBeTypeOf('function')

    const firstResult = await largeFilesHandler?.({}, '/Users/test/Downloads', 50) as { ok: boolean; data?: unknown }
    expect(firstResult.ok).toBe(true)
    expect(firstResult.data).toEqual([
      expect.objectContaining({ name: 'before.zip', path: '/Users/test/Downloads/before.zip', size: 200, modified: 1 })
    ])
    expect(scanFolderMock).toHaveBeenCalledTimes(1)

    const invalidateResult = await invalidateHandler?.({}, '/Users/test/Downloads') as { ok: boolean; data?: boolean }
    expect(invalidateResult).toEqual({ ok: true, data: true })

    const secondResult = await largeFilesHandler?.({}, '/Users/test/Downloads', 50) as { ok: boolean; data?: unknown }
    expect(secondResult.ok).toBe(true)
    expect(secondResult.data).toEqual([
      expect.objectContaining({ name: 'after.zip', path: '/Users/test/Downloads/after.zip', size: 120, modified: 2 })
    ])
    expect(scanFolderMock).toHaveBeenCalledTimes(2)
    expect(findLargeFilesMock).toHaveBeenLastCalledWith(refreshedScanResult.tree, 50)
  })
})
