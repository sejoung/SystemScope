import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())
const onMock = vi.hoisted(() => vi.fn())
const removeListenerMock = vi.hoisted(() => vi.fn())
const randomUUIDMock = vi.hoisted(() => vi.fn(() => 'test-uuid-1234'))

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    removeListener: removeListenerMock
  }
}))

vi.stubGlobal('crypto', { randomUUID: randomUUIDMock })

import { createIpcApi } from '../../src/preload/createIpcApi'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'
import type { SystemScopeApi } from '../../src/shared/contracts/systemScope'

const EXPECTED_API_KEYS: (keyof SystemScopeApi)[] = [
  'logRendererError',
  'setUnsavedSettingsState',
  'getAboutInfo',
  'openAboutWindow',
  'openHomepage',
  'checkForUpdate',
  'getUpdateStatus',
  'openUpdateRelease',
  'onUpdateAvailable',
  'getSystemStats',
  'subscribeSystem',
  'unsubscribeSystem',
  'onSystemUpdate',
  'scanFolder',
  'invalidateScanCache',
  'getLargeFiles',
  'getExtensionBreakdown',
  'quickScan',
  'getUserSpace',
  'findRecentGrowth',
  'findDuplicates',
  'getGrowthView',
  'findOldFiles',
  'trashDiskItems',
  'listDockerImages',
  'removeDockerImages',
  'listDockerContainers',
  'removeDockerContainers',
  'stopDockerContainers',
  'listDockerVolumes',
  'removeDockerVolumes',
  'getDockerBuildCache',
  'pruneDockerBuildCache',
  'getTopCpuProcesses',
  'getTopMemoryProcesses',
  'getAllProcesses',
  'getProcessSnapshot',
  'getNetworkPorts',
  'killProcess',
  'listInstalledApps',
  'getAppRelatedData',
  'listLeftoverAppData',
  'hydrateLeftoverAppDataSizes',
  'removeLeftoverAppData',
  'listLeftoverAppRegistry',
  'removeLeftoverAppRegistry',
  'uninstallApp',
  'openAppLocation',
  'openSystemUninstallSettings',
  'getActiveAlerts',
  'dismissAlert',
  'onAlertFired',
  'onShutdownState',
  'cancelJob',
  'onJobProgress',
  'onJobCompleted',
  'onJobFailed',
  'getTimelineData',
  'getTimelinePointDetail',
  'getEventHistory',
  'getRecentEvents',
  'getDiagnosisSummary',
  'getAlertIntelligence',
  'getAlertHistory',
  'getCleanupRules',
  'setCleanupRuleConfig',
  'previewCleanup',
  'executeCleanup',
  'getCleanupInbox',
  'dismissCleanupItem',
  'getSettings',
  'setSettings',
  'getDataPath',
  'getSystemLogPath',
  'getAccessLogPath',
  'selectFolder',
  'showInFolder',
  'openPath'
]

const LISTENER_KEYS: (keyof SystemScopeApi)[] = [
  'onSystemUpdate',
  'onAlertFired',
  'onShutdownState',
  'onUpdateAvailable',
  'onJobProgress',
  'onJobCompleted',
  'onJobFailed'
]

describe('createIpcApi', () => {
  let api: SystemScopeApi

  beforeEach(() => {
    invokeMock.mockReset()
    onMock.mockReset()
    removeListenerMock.mockReset()
    randomUUIDMock.mockReturnValue('test-uuid-1234')
    api = createIpcApi()
  })

  const requestMeta = { __requestMeta: { requestId: 'test-uuid-1234' } }

  describe('API completeness', () => {
    it('should return an object with every SystemScopeApi key', () => {
      const keys = Object.keys(api).sort()
      const expected = [...EXPECTED_API_KEYS].sort()
      expect(keys).toEqual(expected)
    })

    it('should have a function for every key', () => {
      for (const key of EXPECTED_API_KEYS) {
        expect(typeof api[key]).toBe('function')
      }
    })
  })

  describe('invoke methods call ipcRenderer.invoke with correct channel', () => {
    it('getSystemStats → SYSTEM_GET_STATS', async () => {
      await api.getSystemStats()
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.SYSTEM_GET_STATS,
        requestMeta
      )
    })

    it('scanFolder → DISK_SCAN_FOLDER with folderPath', async () => {
      await api.scanFolder('/home/user/docs')
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.DISK_SCAN_FOLDER,
        '/home/user/docs',
        requestMeta
      )
    })

    it('killProcess → PROCESS_KILL with request', async () => {
      const request = { pid: 42, name: 'test', reason: 'testing' }
      await api.killProcess(request)
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.PROCESS_KILL,
        request,
        requestMeta
      )
    })

    it('getLargeFiles → DISK_GET_LARGE_FILES with folderPath and limit', async () => {
      await api.getLargeFiles('/tmp', 10)
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.DISK_GET_LARGE_FILES,
        '/tmp',
        10,
        requestMeta
      )
    })

    it('getSettings → SETTINGS_GET', async () => {
      await api.getSettings()
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.SETTINGS_GET,
        requestMeta
      )
    })

    it('dismissAlert → ALERT_DISMISS with alertId', async () => {
      await api.dismissAlert('alert-1')
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.ALERT_DISMISS,
        'alert-1',
        requestMeta
      )
    })

    it('selectFolder → DIALOG_SELECT_FOLDER', async () => {
      await api.selectFolder()
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.DIALOG_SELECT_FOLDER,
        requestMeta
      )
    })

    it('logRendererError → APP_LOG_RENDERER_ERROR with scope, message, details', async () => {
      await api.logRendererError('renderer', 'something broke', { stack: 'trace' })
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.APP_LOG_RENDERER_ERROR,
        { scope: 'renderer', message: 'something broke', details: { stack: 'trace' } },
        requestMeta
      )
    })

    it('removeDockerImages → DOCKER_REMOVE_IMAGES with imageIds', async () => {
      await api.removeDockerImages(['img-1', 'img-2'])
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.DOCKER_REMOVE_IMAGES,
        ['img-1', 'img-2'],
        requestMeta
      )
    })
  })

  describe('listener methods', () => {
    const LISTENER_CHANNEL_MAP: Record<string, string> = {
      onSystemUpdate: IPC_CHANNELS.EVENT_SYSTEM_UPDATE,
      onAlertFired: IPC_CHANNELS.EVENT_ALERT_FIRED,
      onShutdownState: IPC_CHANNELS.EVENT_SHUTDOWN_STATE,
      onUpdateAvailable: IPC_CHANNELS.EVENT_UPDATE_AVAILABLE,
      onJobProgress: IPC_CHANNELS.JOB_PROGRESS,
      onJobCompleted: IPC_CHANNELS.JOB_COMPLETED,
      onJobFailed: IPC_CHANNELS.JOB_FAILED
    }

    for (const key of LISTENER_KEYS) {
      it(`${key} should register listener on correct channel and return unsubscribe`, () => {
        const callback = vi.fn()
        const unsubscribe = (api[key] as (cb: (data: unknown) => void) => () => void)(callback)

        expect(typeof unsubscribe).toBe('function')
        expect(onMock).toHaveBeenCalledWith(
          LISTENER_CHANNEL_MAP[key],
          expect.any(Function)
        )
      })
    }

    it('unsubscribe should call ipcRenderer.removeListener', () => {
      const callback = vi.fn()
      const unsubscribe = api.onSystemUpdate(callback)

      const registeredHandler = onMock.mock.calls[0][1]
      unsubscribe()

      expect(removeListenerMock).toHaveBeenCalledWith(
        IPC_CHANNELS.EVENT_SYSTEM_UPDATE,
        registeredHandler
      )
    })

    it('listener handler should forward data to callback', () => {
      const callback = vi.fn()
      api.onAlertFired(callback)

      const registeredHandler = onMock.mock.calls[0][1]
      const fakeEvent = {} as Electron.IpcRendererEvent
      registeredHandler(fakeEvent, { alert: 'cpu-high' })

      expect(callback).toHaveBeenCalledWith({ alert: 'cpu-high' })
    })
  })
})
