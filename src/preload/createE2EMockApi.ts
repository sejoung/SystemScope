import type { SystemScopeApi } from '@shared/contracts/systemScope'
import { createIpcApi } from './createIpcApi'
import { successResult } from './helpers'

export interface E2EMockControls {
  setUpdateAvailable: (value: boolean) => void
  reset: () => void
}

export function createE2EMockApi(): {
  api: SystemScopeApi
  controls: E2EMockControls
} {
  const api = createIpcApi()
  const initialUpdateAvailable = process.env.E2E_UPDATE_AVAILABLE === '1'
  let updateAvailable = initialUpdateAvailable

  const buildUpdateStatus = () => ({
    currentVersion: '1.1.2',
    checking: false,
    updateInfo: updateAvailable
      ? {
          currentVersion: '1.1.2',
          latestVersion: '1.3.0',
          hasUpdate: true,
          releaseUrl: 'https://sejoung.github.io/SystemScope/',
          releaseNotes: 'Test release',
          publishedAt: '2026-03-26T00:00:00.000Z'
        }
      : null,
    lastCheckedAt: updateAvailable ? new Date().toISOString() : null
  } as const)

  const mockSystemStats = {
    cpu: {
      usage: 12,
      cores: [8, 10, 12, 9],
      temperature: null,
      model: 'E2E CPU',
      speed: 3.2
    },
    memory: {
      total: 16_000_000_000,
      used: 6_000_000_000,
      active: 5_500_000_000,
      available: 10_000_000_000,
      cached: 2_000_000_000,
      usage: 37,
      swapTotal: 0,
      swapUsed: 0
    },
    gpu: {
      available: false,
      model: null,
      usage: null,
      memoryTotal: null,
      memoryUsed: null,
      temperature: null,
      unavailableReason: null
    },
    disk: {
      drives: [
        {
          fs: '/dev/disk1s1',
          type: 'apfs',
          size: 500_000_000_000,
          used: 200_000_000_000,
          available: 300_000_000_000,
          usage: 40,
          mount: '/',
          purgeable: null,
          realUsage: null
        }
      ]
    },
    timestamp: Date.now()
  }

  const mockProcesses = [
    {
      pid: 1001,
      name: 'node',
      cpu: 12.5,
      memory: 120,
      memoryBytes: 120_000_000,
      command: '/usr/bin/node server.js'
    }
  ]

  Object.assign(api, {
    getSettings: () =>
      successResult({
        thresholds: {
          diskWarning: 75,
          diskCritical: 85,
          memoryWarning: 75,
          memoryCritical: 85,
          gpuMemoryWarning: 75,
          gpuMemoryCritical: 85
        },
        theme: 'dark' as const,
        locale: 'en' as const,
        snapshotIntervalMin: 60
      }),
    getUpdateStatus: () =>
      successResult(buildUpdateStatus()),
    checkForUpdate: () =>
      successResult({
        ...buildUpdateStatus(),
        lastCheckedAt: new Date().toISOString()
      }),
    openUpdateRelease: () => successResult(true),
    onUpdateAvailable: () => () => {},
    getActiveAlerts: () => successResult([]),
    subscribeSystem: () => successResult(true),
    unsubscribeSystem: () => successResult(true),
    getSystemStats: () => successResult(mockSystemStats),
    getAllProcesses: () => successResult(mockProcesses),
    getTopCpuProcesses: () => successResult(mockProcesses),
    getTopMemoryProcesses: () => successResult(mockProcesses),
    listInstalledApps: () =>
      successResult([
        {
          id: 'mock-app',
          name: 'Mock App',
          version: '1.0.0',
          publisher: 'SystemScope',
          installLocation: '/Applications/Mock App.app',
          platform: 'mac' as const,
          uninstallKind: 'trash_app' as const,
          protected: false
        }
      ]),
    getAppRelatedData: () => successResult([]),
    listLeftoverAppData: () => successResult([]),
    hydrateLeftoverAppDataSizes: () => successResult([]),
    listLeftoverAppRegistry: () => successResult([]),
    listDockerContainers: () =>
      successResult({
        status: 'ready' as const,
        containers: [],
        message: null
      }),
    listDockerImages: () =>
      successResult({
        status: 'ready' as const,
        images: [],
        message: null
      }),
    listDockerVolumes: () =>
      successResult({
        status: 'ready' as const,
        volumes: [],
        message: null
      }),
    getDockerBuildCache: () =>
      successResult({
        status: 'ready' as const,
        summary: {
          totalCount: 0,
          activeCount: 0,
          sizeBytes: 0,
          sizeLabel: '0 B',
          reclaimableBytes: 0,
          reclaimableLabel: '0 B'
        },
        message: null
      }),
    getUserSpace: () =>
      successResult({
        homePath: '/Users/e2e',
        homeSize: 200_000_000_000,
        diskTotal: 500_000_000_000,
        diskAvailable: 300_000_000_000,
        diskUsage: 40,
        purgeable: null,
        entries: []
      }),
    getGrowthView: () =>
      successResult({
        period: '7d',
        cutoffMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
        folders: [],
        totalAdded: 0,
        totalAddedFiles: 0
      }),
    quickScan: () => successResult([])
  } satisfies Partial<SystemScopeApi>)

  return {
    api,
    controls: {
      setUpdateAvailable: (value: boolean) => {
        updateAvailable = value
      },
      reset: () => {
        updateAvailable = initialUpdateAvailable
      }
    }
  }
}
