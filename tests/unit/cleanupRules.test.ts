import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/main/store/settingsSchema'

const statMock = vi.hoisted(() => vi.fn())
const lstatMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const readdirMock = vi.hoisted(() => vi.fn())
const trashItemMock = vi.hoisted(() => vi.fn())
const adminMoveToTrashMock = vi.hoisted(() => vi.fn())
const getSettingsMock = vi.hoisted(() => vi.fn())
const setSettingsMock = vi.hoisted(() => vi.fn())
const listDockerContainersMock = vi.hoisted(() => vi.fn())
const removeDockerContainersMock = vi.hoisted(() => vi.fn())
const recordEventMock = vi.hoisted(() => vi.fn())
const logInfoMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())
const getDirSizeMock = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({
  stat: statMock,
  lstat: lstatMock,
  access: accessMock,
  readdir: readdirMock
}))

vi.mock('node:os', () => ({
  homedir: () => '/Users/test',
  platform: () => 'darwin',
  tmpdir: () => '/tmp'
}))

vi.mock('../../src/main/services/core/adminShell.mac', () => ({
  adminMoveToTrash: adminMoveToTrashMock,
  shellQuote: (v: string) => v,
  runAdminShellScript: vi.fn()
}))

vi.mock('electron', () => ({
  shell: {
    trashItem: trashItemMock
  }
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: getSettingsMock,
  setSettings: setSettingsMock
}))

vi.mock('../../src/main/services/docker/dockerImages', () => ({
  listDockerContainers: listDockerContainersMock,
  removeDockerContainers: removeDockerContainersMock
}))

vi.mock('../../src/main/services/history/eventStore', () => ({
  recordEvent: recordEventMock
}))

vi.mock('../../src/main/services/core/logging', () => ({
  logInfo: logInfoMock,
  logWarn: logWarnMock
}))

vi.mock('../../src/main/utils/getDirSize', () => ({
  getDirSize: getDirSizeMock
}))

describe('cleanupRules', () => {
  beforeEach(() => {
    vi.resetModules()
    statMock.mockReset()
    lstatMock.mockReset()
    accessMock.mockReset()
    readdirMock.mockReset()
    trashItemMock.mockReset()
    adminMoveToTrashMock.mockReset()
    getSettingsMock.mockReset()
    setSettingsMock.mockReset()
    listDockerContainersMock.mockReset()
    removeDockerContainersMock.mockReset()
    recordEventMock.mockReset()
    logInfoMock.mockReset()
    logWarnMock.mockReset()
    getDirSizeMock.mockReset()

    getSettingsMock.mockReturnValue(DEFAULT_SETTINGS)
    accessMock.mockResolvedValue(undefined)
    readdirMock.mockResolvedValue([])
    recordEventMock.mockResolvedValue(undefined)
  })

  it('should compute directory sizes during preview', async () => {
    readdirMock.mockResolvedValue([{ name: 'DerivedData-old', isDirectory: () => true }])
    statMock.mockResolvedValue({
      isDirectory: () => true,
      size: 512,
      mtimeMs: 0
    })
    getDirSizeMock.mockResolvedValue(4096)

    const { previewCleanup } = await import('../../src/main/services/cleanup/cleanupRules')
    const preview = await previewCleanup()

    const item = preview.items.find((entry) => entry.path.endsWith('DerivedData-old'))
    expect(item?.size).toBe(4096)
  })

  it('should delete docker cleanup targets through Docker APIs instead of shell trash', async () => {
    listDockerContainersMock.mockResolvedValue({
      status: 'ready',
      containers: [
        { id: 'container-1', sizeBytes: 2048, running: false }
      ],
      message: null
    })
    removeDockerContainersMock.mockResolvedValue({
      deletedIds: ['container-1'],
      failCount: 0,
      errors: [],
      cancelled: false
    })

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests(['docker:container:container-1'])
    const result = await executeCleanup(['docker:container:container-1'])

    expect(removeDockerContainersMock).toHaveBeenCalledWith(['container-1'])
    expect(trashItemMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      deletedCount: 1,
      deletedSize: 2048,
      failedCount: 0
    })
  })

  it('should account for directory size when trashing filesystem entries', async () => {
    statMock.mockResolvedValue({
      isDirectory: () => true,
      size: 128
    })
    getDirSizeMock.mockResolvedValue(8192)

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests(['/tmp/cache-dir'])
    const result = await executeCleanup(['/tmp/cache-dir'])

    expect(getDirSizeMock).toHaveBeenCalledWith('/tmp/cache-dir')
    expect(trashItemMock).toHaveBeenCalledWith('/tmp/cache-dir')
    expect(result.deletedSize).toBe(8192)
  })

  it('retries permission-blocked items through one admin prompt and counts them as deleted', async () => {
    const blockedPath = '/Users/test/Library/Logs/Wondershare'
    statMock.mockResolvedValue({ isDirectory: () => true, size: 0 })
    getDirSizeMock.mockResolvedValue(4096)
    trashItemMock.mockRejectedValue(new Error('permission denied'))
    lstatMock.mockResolvedValue({}) // still on disk after the failed trash → permission problem
    adminMoveToTrashMock.mockResolvedValue({ moved: [blockedPath], failed: [] })

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests([blockedPath])
    const result = await executeCleanup([blockedPath])

    expect(adminMoveToTrashMock).toHaveBeenCalledWith([blockedPath])
    expect(result).toMatchObject({ deletedCount: 1, deletedSize: 4096, failedCount: 0 })
  })

  it('reports items as failed when the admin retry does not move them (e.g. prompt canceled)', async () => {
    const blockedPath = '/Users/test/Library/Caches/RootDependence'
    statMock.mockResolvedValue({ isDirectory: () => false, size: 100 })
    trashItemMock.mockRejectedValue(new Error('permission denied'))
    lstatMock.mockResolvedValue({})
    adminMoveToTrashMock.mockResolvedValue({ moved: [], failed: [blockedPath] })

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests([blockedPath])
    const result = await executeCleanup([blockedPath])

    expect(result).toMatchObject({ deletedCount: 0, failedCount: 1 })
    expect(result.failedPaths).toContain(blockedPath)
  })

  it('does not invoke the admin prompt for items that already vanished', async () => {
    const gonePath = '/Users/test/Library/Caches/AlreadyGone'
    statMock.mockRejectedValue(new Error('ENOENT'))
    lstatMock.mockRejectedValue(new Error('ENOENT')) // gone — nothing to retry as admin

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests([gonePath])
    const result = await executeCleanup([gonePath])

    expect(adminMoveToTrashMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({ deletedCount: 0, failedCount: 1 })
  })

  it('should reject targets that were not part of the last preview', async () => {
    statMock.mockResolvedValue({ isDirectory: () => false, size: 100 })
    trashItemMock.mockResolvedValue(undefined)

    const { executeCleanup, __setPreviewedTargetsForTests } = await import('../../src/main/services/cleanup/cleanupRules')
    __setPreviewedTargetsForTests(['/tmp/previewed-dir'])
    const result = await executeCleanup(['/etc/passwd', '/tmp/previewed-dir'])

    // Only the previewed path is stat'd/trashed; the injected path never touches the FS.
    expect(statMock).not.toHaveBeenCalledWith('/etc/passwd')
    expect(trashItemMock).not.toHaveBeenCalledWith('/etc/passwd')
    expect(result.failedCount).toBe(1)
    expect(result.failedPaths).toContain('/etc/passwd')
  })
})
