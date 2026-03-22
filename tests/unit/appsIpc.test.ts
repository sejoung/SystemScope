import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const showMessageBox = vi.hoisted(() => vi.fn())
const listInstalledAppsMock = vi.hoisted(() => vi.fn())
const getInstalledAppByIdMock = vi.hoisted(() => vi.fn())
const getInstalledAppRelatedDataMock = vi.hoisted(() => vi.fn())
const openInstalledAppLocationMock = vi.hoisted(() => vi.fn())
const openSystemUninstallSettingsMock = vi.hoisted(() => vi.fn())
const uninstallInstalledAppMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())
const logInfoMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  dialog: {
    showMessageBox
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/services/installedApps', () => ({
  listInstalledApps: listInstalledAppsMock,
  getInstalledAppById: getInstalledAppByIdMock,
  getInstalledAppRelatedData: getInstalledAppRelatedDataMock,
  openInstalledAppLocation: openInstalledAppLocationMock,
  openSystemUninstallSettings: openSystemUninstallSettingsMock,
  uninstallInstalledApp: uninstallInstalledAppMock
}))

vi.mock('../../src/main/services/logging', () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
  logWarn: logWarnMock
}))

describe('registerAppsIpc', () => {
  beforeEach(() => {
    vi.resetModules()
    handlers.clear()
    showMessageBox.mockReset()
    listInstalledAppsMock.mockReset()
    getInstalledAppByIdMock.mockReset()
    getInstalledAppRelatedDataMock.mockReset()
    openInstalledAppLocationMock.mockReset()
    openSystemUninstallSettingsMock.mockReset()
    uninstallInstalledAppMock.mockReset()
    logErrorMock.mockReset()
    logInfoMock.mockReset()
    logWarnMock.mockReset()
  })

  it('should return installed apps', async () => {
    listInstalledAppsMock.mockResolvedValue([{ id: 'app-1', name: 'Example', platform: 'mac' }])

    const { registerAppsIpc } = await import('../../src/main/ipc/apps.ipc')
    registerAppsIpc()

    const handler = handlers.get(IPC_CHANNELS.APPS_LIST_INSTALLED)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, undefined) as { ok: boolean; data?: unknown }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual([{ id: 'app-1', name: 'Example', platform: 'mac' }])
  })

  it('should reject invalid uninstall requests', async () => {
    const { registerAppsIpc } = await import('../../src/main/ipc/apps.ipc')
    registerAppsIpc()

    const handler = handlers.get(IPC_CHANNELS.APPS_UNINSTALL)
    expect(handler).toBeTypeOf('function')

    const result = await handler?.({}, { appId: '' }) as { ok: boolean; error?: { code: string } }
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('INVALID_INPUT')
    expect(logWarnMock).toHaveBeenCalled()
  })

  it('should return related app data', async () => {
    getInstalledAppRelatedDataMock.mockResolvedValue([{ id: '1', label: 'Caches', path: '/tmp/app', source: 'mac:caches' }])

    const { registerAppsIpc } = await import('../../src/main/ipc/apps.ipc')
    registerAppsIpc()

    const handler = handlers.get(IPC_CHANNELS.APPS_GET_RELATED_DATA)
    const result = await handler?.({}, 'app-1') as { ok: boolean; data?: unknown[] }

    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('should cancel uninstall when user aborts', async () => {
    getInstalledAppByIdMock.mockReturnValue({
      id: 'app-1',
      name: 'Example',
      platform: 'mac',
      protected: false
    })
    showMessageBox.mockResolvedValue({ response: 0 })

    const { registerAppsIpc } = await import('../../src/main/ipc/apps.ipc')
    registerAppsIpc()

    const handler = handlers.get(IPC_CHANNELS.APPS_UNINSTALL)
    const result = await handler?.({}, { appId: 'app-1', relatedDataPaths: ['/tmp/data'] }) as { ok: boolean; data?: { cancelled: boolean } }

    expect(result.ok).toBe(true)
    expect(result.data?.cancelled).toBe(true)
    expect(uninstallInstalledAppMock).not.toHaveBeenCalled()
  })

  it('should start uninstall after confirmation', async () => {
    getInstalledAppByIdMock.mockReturnValue({
      id: 'app-1',
      name: 'Example',
      platform: 'windows',
      protected: false,
      uninstallKind: 'uninstall_command'
    })
    showMessageBox.mockResolvedValue({ response: 1 })
    uninstallInstalledAppMock.mockResolvedValue({
      id: 'app-1',
      name: 'Example',
      started: true,
      completed: false,
      cancelled: false,
      message: '제거 프로그램을 시작했습니다.'
    })

    const { registerAppsIpc } = await import('../../src/main/ipc/apps.ipc')
    registerAppsIpc()

    const handler = handlers.get(IPC_CHANNELS.APPS_UNINSTALL)
    const result = await handler?.({}, { appId: 'app-1', relatedDataPaths: ['C:\\Users\\me\\AppData\\Roaming\\Example'] }) as { ok: boolean; data?: { started: boolean } }

    expect(result.ok).toBe(true)
    expect(result.data?.started).toBe(true)
    expect(uninstallInstalledAppMock).toHaveBeenCalledWith({
      appId: 'app-1',
      relatedDataPaths: ['C:\\Users\\me\\AppData\\Roaming\\Example']
    })
  })
})
