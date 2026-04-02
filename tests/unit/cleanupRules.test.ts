import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/main/store/settingsSchema'

const statMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const readdirMock = vi.hoisted(() => vi.fn())
const trashItemMock = vi.hoisted(() => vi.fn())
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
  access: accessMock,
  readdir: readdirMock
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

vi.mock('../../src/main/services/dockerImages', () => ({
  listDockerContainers: listDockerContainersMock,
  removeDockerContainers: removeDockerContainersMock
}))

vi.mock('../../src/main/services/eventStore', () => ({
  recordEvent: recordEventMock
}))

vi.mock('../../src/main/services/logging', () => ({
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
    accessMock.mockReset()
    readdirMock.mockReset()
    trashItemMock.mockReset()
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

    const { previewCleanup } = await import('../../src/main/services/cleanupRules')
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

    const { executeCleanup } = await import('../../src/main/services/cleanupRules')
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

    const { executeCleanup } = await import('../../src/main/services/cleanupRules')
    const result = await executeCleanup(['/tmp/cache-dir'])

    expect(getDirSizeMock).toHaveBeenCalledWith('/tmp/cache-dir')
    expect(trashItemMock).toHaveBeenCalledWith('/tmp/cache-dir')
    expect(result.deletedSize).toBe(8192)
  })
})
