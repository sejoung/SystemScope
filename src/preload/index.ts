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

function createRequestMeta() {
  return {
    __requestMeta: {
      requestId: crypto.randomUUID()
    }
  }
}

function invokeWithRequestId(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args, createRequestMeta())
}

const api: SystemScopeApi = {
  // 앱
  logRendererError: (scope: string, message: string, details?: unknown) =>
    invokeWithRequestId(IPC_CHANNELS.APP_LOG_RENDERER_ERROR, { scope, message, details }),
  setUnsavedSettingsState: (hasUnsavedSettings: boolean) =>
    invokeWithRequestId(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, { hasUnsavedSettings }),
  getAboutInfo: () => invokeWithRequestId(IPC_CHANNELS.APP_GET_ABOUT_INFO),
  openAboutWindow: () => invokeWithRequestId(IPC_CHANNELS.APP_OPEN_ABOUT),
  openHomepage: () => invokeWithRequestId(IPC_CHANNELS.APP_OPEN_HOMEPAGE),

  // 시스템
  getSystemStats: () => invokeWithRequestId(IPC_CHANNELS.SYSTEM_GET_STATS),
  subscribeSystem: () => invokeWithRequestId(IPC_CHANNELS.SYSTEM_SUBSCRIBE),
  unsubscribeSystem: () => invokeWithRequestId(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE),
  onSystemUpdate: createListener(IPC_CHANNELS.EVENT_SYSTEM_UPDATE),

  // 디스크
  scanFolder: (folderPath: string) => invokeWithRequestId(IPC_CHANNELS.DISK_SCAN_FOLDER, folderPath),
  invalidateScanCache: (folderPath: string) => invokeWithRequestId(IPC_CHANNELS.DISK_INVALIDATE_SCAN_CACHE, folderPath),
  getLargeFiles: (folderPath: string, limit: number) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_GET_LARGE_FILES, folderPath, limit),
  getExtensionBreakdown: (folderPath: string) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_GET_EXTENSIONS, folderPath),
  quickScan: () => invokeWithRequestId(IPC_CHANNELS.DISK_QUICK_SCAN),
  getUserSpace: () => invokeWithRequestId(IPC_CHANNELS.DISK_USER_SPACE),
  findRecentGrowth: (folderPath: string, days: number) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_RECENT_GROWTH, folderPath, days),
  findDuplicates: (folderPath: string, minSizeKB: number) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_FIND_DUPLICATES, folderPath, minSizeKB),
  getGrowthView: (period: string) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_GROWTH_VIEW, period),
  findOldFiles: (folderPath: string, olderThanDays: number) =>
    invokeWithRequestId(IPC_CHANNELS.DISK_FIND_OLD_FILES, folderPath, olderThanDays),
  trashDiskItems: (request: TrashItemsRequest) => invokeWithRequestId(IPC_CHANNELS.DISK_TRASH_ITEMS, request),

  // Docker
  listDockerImages: () => invokeWithRequestId(IPC_CHANNELS.DOCKER_LIST_IMAGES),
  removeDockerImages: (imageIds: string[]) => invokeWithRequestId(IPC_CHANNELS.DOCKER_REMOVE_IMAGES, imageIds),
  listDockerContainers: () => invokeWithRequestId(IPC_CHANNELS.DOCKER_LIST_CONTAINERS),
  removeDockerContainers: (containerIds: string[]) => invokeWithRequestId(IPC_CHANNELS.DOCKER_REMOVE_CONTAINERS, containerIds),
  stopDockerContainers: (containerIds: string[]) => invokeWithRequestId(IPC_CHANNELS.DOCKER_STOP_CONTAINERS, containerIds),
  listDockerVolumes: () => invokeWithRequestId(IPC_CHANNELS.DOCKER_LIST_VOLUMES),
  removeDockerVolumes: (volumeNames: string[]) => invokeWithRequestId(IPC_CHANNELS.DOCKER_REMOVE_VOLUMES, volumeNames),
  getDockerBuildCache: () => invokeWithRequestId(IPC_CHANNELS.DOCKER_GET_BUILD_CACHE),
  pruneDockerBuildCache: () => invokeWithRequestId(IPC_CHANNELS.DOCKER_PRUNE_BUILD_CACHE),

  // 프로세스
  getTopCpuProcesses: (limit: number) => invokeWithRequestId(IPC_CHANNELS.PROCESS_GET_TOP_CPU, limit),
  getTopMemoryProcesses: (limit: number) => invokeWithRequestId(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, limit),
  getAllProcesses: () => invokeWithRequestId(IPC_CHANNELS.PROCESS_GET_ALL),
  getNetworkPorts: () => invokeWithRequestId(IPC_CHANNELS.PROCESS_GET_PORTS),
  killProcess: (request: { pid: number; name?: string; command?: string; reason?: string }) =>
    invokeWithRequestId(IPC_CHANNELS.PROCESS_KILL, request),

  // 앱 관리
  listInstalledApps: () => invokeWithRequestId(IPC_CHANNELS.APPS_LIST_INSTALLED),
  getAppRelatedData: (appId: string) => invokeWithRequestId(IPC_CHANNELS.APPS_GET_RELATED_DATA, appId),
  listLeftoverAppData: () => invokeWithRequestId(IPC_CHANNELS.APPS_LIST_LEFTOVER_DATA),
  removeLeftoverAppData: (itemIds: string[]) => invokeWithRequestId(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_DATA, itemIds),
  listLeftoverAppRegistry: () => invokeWithRequestId(IPC_CHANNELS.APPS_LIST_LEFTOVER_REGISTRY),
  removeLeftoverAppRegistry: (itemIds: string[]) => invokeWithRequestId(IPC_CHANNELS.APPS_REMOVE_LEFTOVER_REGISTRY, itemIds),
  uninstallApp: (request: AppUninstallRequest) => invokeWithRequestId(IPC_CHANNELS.APPS_UNINSTALL, request),
  openAppLocation: (appId: string) => invokeWithRequestId(IPC_CHANNELS.APPS_OPEN_LOCATION, appId),
  openSystemUninstallSettings: () => invokeWithRequestId(IPC_CHANNELS.APPS_OPEN_SYSTEM_SETTINGS),

  // 알림
  getActiveAlerts: () => invokeWithRequestId(IPC_CHANNELS.ALERT_GET_ACTIVE),
  dismissAlert: (alertId: string) => invokeWithRequestId(IPC_CHANNELS.ALERT_DISMISS, alertId),
  onAlertFired: createListener(IPC_CHANNELS.EVENT_ALERT_FIRED),
  onShutdownState: createListener(IPC_CHANNELS.EVENT_SHUTDOWN_STATE),

  // 작업
  cancelJob: (jobId: string) => invokeWithRequestId(IPC_CHANNELS.JOB_CANCEL, jobId),
  onJobProgress: createListener(IPC_CHANNELS.JOB_PROGRESS),
  onJobCompleted: createListener(IPC_CHANNELS.JOB_COMPLETED),
  onJobFailed: createListener(IPC_CHANNELS.JOB_FAILED),

  // 설정
  getSettings: () => invokeWithRequestId(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings) => invokeWithRequestId(IPC_CHANNELS.SETTINGS_SET, settings),
  getDataPath: () => invokeWithRequestId(IPC_CHANNELS.SETTINGS_GET_DATA_PATH),
  getSystemLogPath: () => invokeWithRequestId(IPC_CHANNELS.SETTINGS_GET_SYSTEM_LOG_PATH),
  getAccessLogPath: () => invokeWithRequestId(IPC_CHANNELS.SETTINGS_GET_ACCESS_LOG_PATH),

  // 다이얼로그
  selectFolder: () => invokeWithRequestId(IPC_CHANNELS.DIALOG_SELECT_FOLDER),

  // 셸 — Finder / 탐색기에서 열기
  showInFolder: (targetPath: string) => invokeWithRequestId(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, targetPath),
  openPath: (targetPath: string) => invokeWithRequestId(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath)
}

contextBridge.exposeInMainWorld('systemScope', api)

export type { SystemScopeApi } from '@shared/contracts/systemScope'
