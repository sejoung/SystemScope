import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const listDockerImages = vi.hoisted(() => vi.fn())
const removeDockerImages = vi.hoisted(() => vi.fn())
const listDockerContainers = vi.hoisted(() => vi.fn())
const removeDockerContainers = vi.hoisted(() => vi.fn())
const stopDockerContainers = vi.hoisted(() => vi.fn())
const listDockerVolumes = vi.hoisted(() => vi.fn())
const removeDockerVolumes = vi.hoisted(() => vi.fn())
const getDockerBuildCache = vi.hoisted(() => vi.fn())
const pruneDockerBuildCache = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())
const logError = vi.hoisted(() => vi.fn())
const trashItemsWithConfirm = vi.hoisted(() => vi.fn())
const scanFolder = vi.hoisted(() => vi.fn())
const findLargeFiles = vi.hoisted(() => vi.fn())

const mockWindow = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: {
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
    getFocusedWindow: vi.fn(() => mockWindow),
    getAllWindows: vi.fn(() => [mockWindow])
  },
  dialog: {
    showMessageBox
  }
}))

vi.mock('fs/promises', () => ({
  default: {},
  access: vi.fn(() => Promise.resolve()),
  constants: { R_OK: 4 }
}))

vi.mock('electron-log', () => ({
  default: {
    error: logError,
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('../../src/main/services/dockerImages', () => ({
  listDockerImages,
  removeDockerImages,
  listDockerContainers,
  removeDockerContainers,
  stopDockerContainers,
  listDockerVolumes,
  removeDockerVolumes,
  getDockerBuildCache,
  pruneDockerBuildCache
}))

vi.mock('../../src/main/services/diskAnalyzer', () => ({
  scanFolder,
  findLargeFiles,
  getExtensionBreakdown: vi.fn()
}))
vi.mock('../../src/main/services/quickScan', () => ({ runQuickScan: vi.fn() }))
vi.mock('../../src/main/services/userSpace', () => ({ getUserSpaceInfo: vi.fn() }))
vi.mock('../../src/main/services/diskInsights', () => ({ findRecentGrowth: vi.fn(), findDuplicates: vi.fn() }))
vi.mock('../../src/main/services/growthAnalyzer', () => ({ analyzeGrowth: vi.fn() }))
vi.mock('../../src/main/services/oldFileFinder', () => ({ findOldFiles: vi.fn() }))
vi.mock('../../src/main/jobs/jobManager', () => ({
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  sendJobProgress: vi.fn(),
  sendJobCompleted: vi.fn(),
  sendJobFailed: vi.fn()
}))
vi.mock('../../src/main/services/trashService', () => ({
  trashItemsWithConfirm
}))

describe('docker disk IPC', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    listDockerImages.mockReset()
    removeDockerImages.mockReset()
    listDockerContainers.mockReset()
    removeDockerContainers.mockReset()
    stopDockerContainers.mockReset()
    listDockerVolumes.mockReset()
    removeDockerVolumes.mockReset()
    getDockerBuildCache.mockReset()
    pruneDockerBuildCache.mockReset()
    showMessageBox.mockReset()
    logError.mockReset()
    trashItemsWithConfirm.mockReset()
    scanFolder.mockReset()
    findLargeFiles.mockReset()
  })

  it('should return docker images scan result', async () => {
    listDockerImages.mockResolvedValue({ status: 'ready', images: [], message: 'Docker 이미지가 없습니다.' })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_LIST_DOCKER_IMAGES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ status: 'ready', images: [], message: 'Docker 이미지가 없습니다.' })
  })

  it('should return deletion keys for large files and only trash registered items', async () => {
    const scanResult = {
      rootPath: '/Users/test/Downloads',
      tree: { name: 'Downloads', path: '/Users/test/Downloads', size: 10, children: [], isFile: false },
      totalSize: 10,
      fileCount: 1,
      folderCount: 1,
      scanDuration: 1
    }
    scanFolder.mockResolvedValue(scanResult)
    findLargeFiles.mockReturnValue([
      { name: 'large.zip', path: '/Users/test/Downloads/large.zip', size: 10, modified: 1 }
    ])
    trashItemsWithConfirm.mockResolvedValue({
      successCount: 1,
      failCount: 0,
      totalSize: 10,
      trashedPaths: ['/Users/test/Downloads/large.zip'],
      errors: []
    })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const listHandler = handlers.get(IPC_CHANNELS.DISK_GET_LARGE_FILES)
    const trashHandler = handlers.get(IPC_CHANNELS.DISK_TRASH_ITEMS)
    expect(listHandler).toBeTypeOf('function')
    expect(trashHandler).toBeTypeOf('function')

    const listResult = await listHandler?.({}, '/Users/test/Downloads', 10) as { ok: boolean; data?: Array<{ deletionKey?: string }> }
    expect(listResult.ok).toBe(true)
    expect(listResult.data?.[0]?.deletionKey).toBeTypeOf('string')

    const invalidTrash = await trashHandler?.({}, { itemIds: ['forged-id'], description: '대용량 파일 삭제' }) as { ok: boolean; error?: { code: string } }
    expect(invalidTrash.ok).toBe(false)
    expect(invalidTrash.error?.code).toBe('INVALID_INPUT')

    const deletionKey = listResult.data?.[0]?.deletionKey
    expect(deletionKey).toBeTypeOf('string')

    const validTrash = await trashHandler?.({}, {
      itemIds: [deletionKey as string],
      description: '대용량 파일 삭제'
    }) as { ok: boolean; data?: unknown }
    expect(validTrash.ok).toBe(true)
    expect(trashItemsWithConfirm).toHaveBeenCalledWith(['/Users/test/Downloads/large.zip'], '대용량 파일 삭제')
  })

  it('should refuse deleting in-use images', async () => {
    listDockerImages.mockResolvedValue({
      status: 'ready',
      message: null,
      images: [
        { id: 'sha256:a', inUse: true, repository: 'node', tag: '20', sizeBytes: 100, sizeLabel: '100B', createdSince: '', shortId: 'a', dangling: false, containers: ['web'] }
      ]
    })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_REMOVE_DOCKER_IMAGES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['sha256:a']) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('PERMISSION_DENIED')
  })

  it('should delete selected docker images after confirmation', async () => {
    listDockerImages.mockResolvedValue({
      status: 'ready',
      message: null,
      images: [
        { id: 'sha256:a', inUse: false, repository: 'node', tag: '20', sizeBytes: 100, sizeLabel: '100B', createdSince: '', shortId: 'a', dangling: false, containers: [] }
      ]
    })
    showMessageBox.mockResolvedValue({ response: 1 })
    removeDockerImages.mockResolvedValue({ deletedIds: ['sha256:a'], failCount: 0, errors: [], cancelled: false })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_REMOVE_DOCKER_IMAGES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['sha256:a']) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ deletedIds: ['sha256:a'], failCount: 0, errors: [], cancelled: false })
    expect(removeDockerImages).toHaveBeenCalledWith(['sha256:a'])
  })

  it('should return docker containers scan result', async () => {
    listDockerContainers.mockResolvedValue({ status: 'ready', containers: [], message: '정리할 Docker 컨테이너가 없습니다.' })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_LIST_DOCKER_CONTAINERS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ status: 'ready', containers: [], message: '정리할 Docker 컨테이너가 없습니다.' })
  })

  it('should refuse deleting running containers', async () => {
    listDockerContainers.mockResolvedValue({
      status: 'ready',
      message: null,
      containers: [
        { id: 'container:a', running: true, name: 'web', image: 'node:20', command: '', status: 'Up 1 hour', ports: '', sizeBytes: 0, shortId: 'container:a' }
      ]
    })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_REMOVE_DOCKER_CONTAINERS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['container:a']) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('PERMISSION_DENIED')
  })

  it('should delete stopped containers after confirmation', async () => {
    listDockerContainers.mockResolvedValue({
      status: 'ready',
      message: null,
      containers: [
        { id: 'container:a', running: false, name: 'web-old', image: 'node:20', command: '', status: 'Exited (0)', ports: '', sizeBytes: 100, shortId: 'container:a' }
      ]
    })
    showMessageBox.mockResolvedValue({ response: 1 })
    removeDockerContainers.mockResolvedValue({ deletedIds: ['container:a'], failCount: 0, errors: [], cancelled: false })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_REMOVE_DOCKER_CONTAINERS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['container:a']) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ deletedIds: ['container:a'], failCount: 0, errors: [], cancelled: false })
    expect(removeDockerContainers).toHaveBeenCalledWith(['container:a'])
  })

  it('should stop running containers after confirmation', async () => {
    listDockerContainers.mockResolvedValue({
      status: 'ready',
      message: null,
      containers: [
        { id: 'container:a', running: true, name: 'web', image: 'node:20', command: '', status: 'Up 1 hour', ports: '', sizeBytes: 0, shortId: 'container:a' }
      ]
    })
    showMessageBox.mockResolvedValue({ response: 1 })
    stopDockerContainers.mockResolvedValue({ affectedIds: ['container:a'], failCount: 0, errors: [], cancelled: false })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_STOP_DOCKER_CONTAINERS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['container:a']) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ affectedIds: ['container:a'], failCount: 0, errors: [], cancelled: false })
    expect(stopDockerContainers).toHaveBeenCalledWith(['container:a'])
  })

  it('should return docker volumes scan result', async () => {
    listDockerVolumes.mockResolvedValue({ status: 'ready', volumes: [], message: 'Docker 볼륨이 없습니다.' })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_LIST_DOCKER_VOLUMES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ status: 'ready', volumes: [], message: 'Docker 볼륨이 없습니다.' })
  })

  it('should refuse deleting in-use volumes', async () => {
    listDockerVolumes.mockResolvedValue({
      status: 'ready',
      message: null,
      volumes: [{ name: 'pgdata', driver: 'local', mountpoint: '/tmp/pgdata', inUse: true, containers: ['db'] }]
    })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_REMOVE_DOCKER_VOLUMES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['pgdata']) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('PERMISSION_DENIED')
  })

  it('should prune docker build cache after confirmation', async () => {
    getDockerBuildCache.mockResolvedValue({
      status: 'ready',
      summary: { totalCount: 10, activeCount: 1, sizeBytes: 1000, sizeLabel: '1000 B', reclaimableBytes: 800, reclaimableLabel: '800 B' },
      message: null
    })
    showMessageBox.mockResolvedValue({ response: 1 })
    pruneDockerBuildCache.mockResolvedValue({ reclaimedBytes: 800, reclaimedLabel: '800 B', cancelled: false })

    const { registerDiskIpc } = await import('../../src/main/ipc/disk.ipc')
    registerDiskIpc()

    const handler = handlers.get(IPC_CHANNELS.DISK_PRUNE_DOCKER_BUILD_CACHE)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ reclaimedBytes: 800, reclaimedLabel: '800 B', cancelled: false })
    expect(pruneDockerBuildCache).toHaveBeenCalled()
  })
})
