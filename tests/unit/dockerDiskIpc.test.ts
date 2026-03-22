import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const listDockerImages = vi.hoisted(() => vi.fn())
const removeDockerImages = vi.hoisted(() => vi.fn())
const listDockerContainers = vi.hoisted(() => vi.fn())
const removeDockerContainers = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())
const logError = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  },
  dialog: {
    showMessageBox
  }
}))

vi.mock('electron-log', () => ({
  default: {
    error: logError
  }
}))

vi.mock('../../src/main/services/dockerImages', () => ({
  listDockerImages,
  removeDockerImages,
  listDockerContainers,
  removeDockerContainers
}))

vi.mock('../../src/main/services/diskAnalyzer', () => ({
  scanFolder: vi.fn(),
  findLargeFiles: vi.fn(),
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

describe('docker disk IPC', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    listDockerImages.mockReset()
    removeDockerImages.mockReset()
    listDockerContainers.mockReset()
    removeDockerContainers.mockReset()
    showMessageBox.mockReset()
    logError.mockReset()
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

  it('should refuse deleting in-use images', async () => {
    listDockerImages.mockResolvedValue({
      status: 'ready',
      message: null,
      images: [
        { id: 'sha256:a', inUse: true, repository: 'node', tag: '20', sizeBytes: 100, sizeLabel: '100B', createdAt: '', createdSince: '', shortId: 'a', dangling: false, containers: ['web'] }
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
        { id: 'sha256:a', inUse: false, repository: 'node', tag: '20', sizeBytes: 100, sizeLabel: '100B', createdAt: '', createdSince: '', shortId: 'a', dangling: false, containers: [] }
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
        { id: 'container:a', running: true, name: 'web', image: 'node:20', imageId: 'sha256:a', command: '', status: 'Up 1 hour', createdSince: '', ports: '', sizeBytes: 0, sizeLabel: '0B', shortId: 'container:a' }
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
        { id: 'container:a', running: false, name: 'web-old', image: 'node:20', imageId: 'sha256:a', command: '', status: 'Exited (0)', createdSince: '', ports: '', sizeBytes: 100, sizeLabel: '100B', shortId: 'container:a' }
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
})
