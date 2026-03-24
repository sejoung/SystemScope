import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type { AppUninstallRequest, TrashItemsRequest } from '@shared/types'
import type { SystemScopeApi } from '@shared/contracts/systemScope'

type Callback = (data: unknown) => void

function createListener(channel: string) {
  return (callback: Callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

const api: SystemScopeApi = {
  // 앱
  logRendererError: (scope: string, message: string, details?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_LOG_RENDERER_ERROR, { scope, message, details }),
  setUnsavedSettingsState: (hasUnsavedSettings: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, { hasUnsavedSettings }),
  getAboutInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_ABOUT_INFO),
  openAboutWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_ABOUT),
  openHomepage: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_HOMEPAGE),

  // 시스템
  getSystemStats: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_STATS),
  subscribeSystem: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SUBSCRIBE),
  unsubscribeSystem: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE),
  onSystemUpdate: createListener(IPC_CHANNELS.EVENT_SYSTEM_UPDATE),

  // 디스크
  scanFolder: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DISK_SCAN_FOLDER, folderPath),
  invalidateScanCache: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE, folderPath),
  getLargeFiles: (folderPath: string, limit: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_GET_LARGE_FILES, folderPath, limit),
  getExtensionBreakdown: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_GET_EXTENSIONS, folderPath),
  quickScan: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_QUICK_SCAN),
  getUserSpace: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_USER_SPACE),
  findRecentGrowth: (folderPath: string, days: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_RECENT_GROWTH, folderPath, days),
  findDuplicates: (folderPath: string, minSizeKB: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_FIND_DUPLICATES, folderPath, minSizeKB),
  getGrowthView: (period: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_GROWTH_VIEW, period),
  findOldFiles: (folderPath: string, olderThanDays: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISK_FIND_OLD_FILES, folderPath, olderThanDays),
  trashDiskItems: (request: TrashItemsRequest) => ipcRenderer.invoke(IPC_CHANNELS.DISK_TRASH_ITEMS, request),

  // Docker
  listDockerImages: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_LIST_IMAGES),
  removeDockerImages: (imageIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_REMOVE_IMAGES, imageIds),
  listDockerContainers: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_LIST_CONTAINERS),
  removeDockerContainers: (containerIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS, containerIds),
  stopDockerContainers: (containerIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_STOP_CONTAINERS, containerIds),
  listDockerVolumes: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_LIST_VOLUMES),
  removeDockerVolumes: (volumeNames: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES, volumeNames),
  getDockerBuildCache: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_GET_BUILD_CACHE),
  pruneDockerBuildCache: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE),

  // 프로세스
  getTopCpuProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_CPU, limit),
  getTopMemoryProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, limit),
  getAllProcesses: () => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_ALL),
  getNetworkPorts: () => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_PORTS),
  killProcess: (request: { pid: number; name?: string; command?: string; reason?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROCESS_KILL, request),

  // 앱 관리
  listInstalledApps: () => ipcRenderer.invoke(IPC_CHANNELS.APPS_LIST_INSTALLED),
  getAppRelatedData: (appId: string) => ipcRenderer.invoke(IPC_CHANNELS.APPS_GET_RELATED_DATA, appId),
  listLeftoverAppData: () => ipcRenderer.invoke(IPC_CHANNELS.APPS_LIST_LEFTOVER_DATA),
  removeLeftoverAppData: (itemIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_DATA, itemIds),
  listLeftoverAppRegistry: () => ipcRenderer.invoke(IPC_CHANNELS.APPS_LIST_LEFTOVER_REGISTRY),
  removeLeftoverAppRegistry: (itemIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_REGISTRY, itemIds),
  uninstallApp: (request: AppUninstallRequest) => ipcRenderer.invoke(IPC_CHANNELS.APPS_UNINSTALL, request),
  openAppLocation: (appId: string) => ipcRenderer.invoke(IPC_CHANNELS.APPS_OPEN_LOCATION, appId),
  openSystemUninstallSettings: () => ipcRenderer.invoke(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS),

  // 알림
  getActiveAlerts: () => ipcRenderer.invoke(IPC_CHANNELS.ALERT_GET_ACTIVE),
  dismissAlert: (alertId: string) => ipcRenderer.invoke(IPC_CHANNELS.ALERT_DISMISS, alertId),
  onAlertFired: createListener(IPC_CHANNELS.EVENT_ALERT_FIRED),
  onShutdownState: createListener(IPC_CHANNELS.EVENT_SHUTDOWN_STATE),

  // 작업
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
  onJobProgress: createListener(IPC_CHANNELS.JOB_PROGRESS),
  onJobCompleted: createListener(IPC_CHANNELS.JOB_COMPLETED),
  onJobFailed: createListener(IPC_CHANNELS.JOB_FAILED),

  // 설정
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  getDataPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_DATA_PATH),
  getLogPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_LOG_PATH),

  // 다이얼로그
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER),

  // 셸 — Finder / 탐색기에서 열기
  showInFolder: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, targetPath),
  openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath)
}

contextBridge.exposeInMainWorld('systemScope', api)

export type { SystemScopeApi } from '@shared/contracts/systemScope'
