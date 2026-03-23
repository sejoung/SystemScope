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

vi.mock('../../src/main/services/logging', () => ({
  logError,
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn()
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
  })

  it('should return docker images scan result', async () => {
    listDockerImages.mockResolvedValue({ status: 'ready', images: [], message: 'Docker 이미지가 없습니다.' })

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_LIST_IMAGES)
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
        { id: 'sha256:a', inUse: true, repository: 'node', tag: '20', sizeBytes: 100, sizeLabel: '100B', createdSince: '', shortId: 'a', dangling: false, containers: ['web'] }
      ]
    })

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_REMOVE_IMAGES)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_REMOVE_IMAGES)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['sha256:a']) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ deletedIds: ['sha256:a'], failCount: 0, errors: [], cancelled: false })
    expect(removeDockerImages).toHaveBeenCalledWith(['sha256:a'])
  })

  it('should return docker containers scan result', async () => {
    listDockerContainers.mockResolvedValue({ status: 'ready', containers: [], message: '정리할 Docker 컨테이너가 없습니다.' })

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_LIST_CONTAINERS)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_STOP_CONTAINERS)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, ['container:a']) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ affectedIds: ['container:a'], failCount: 0, errors: [], cancelled: false })
    expect(stopDockerContainers).toHaveBeenCalledWith(['container:a'])
  })

  it('should return docker volumes scan result', async () => {
    listDockerVolumes.mockResolvedValue({ status: 'ready', volumes: [], message: 'Docker 볼륨이 없습니다.' })

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_LIST_VOLUMES)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES)
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

    const { registerDockerIpc } = await import('../../src/main/ipc/docker.ipc')
    registerDockerIpc()

    const handler = handlers.get(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ reclaimedBytes: 800, reclaimedLabel: '800 B', cancelled: false })
    expect(pruneDockerBuildCache).toHaveBeenCalled()
  })
})
