import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'

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

const api = {
  // App
  logRendererError: (scope: string, message: string, details?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_LOG_RENDERER_ERROR, { scope, message, details }),
  setUnsavedSettingsState: (hasUnsavedSettings: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_SET_UNSAVED_SETTINGS, { hasUnsavedSettings }),

  // System
  getSystemStats: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_STATS),
  subscribeSystem: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SUBSCRIBE),
  unsubscribeSystem: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE),
  onSystemUpdate: createListener(IPC_CHANNELS.EVENT_SYSTEM_UPDATE),

  // Disk
  scanFolder: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DISK_SCAN_FOLDER, folderPath),
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
  listDockerImages: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_LIST_DOCKER_IMAGES),
  removeDockerImages: (imageIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DISK_REMOVE_DOCKER_IMAGES, imageIds),
  listDockerContainers: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_LIST_DOCKER_CONTAINERS),
  removeDockerContainers: (containerIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DISK_REMOVE_DOCKER_CONTAINERS, containerIds),
  stopDockerContainers: (containerIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DISK_STOP_DOCKER_CONTAINERS, containerIds),
  listDockerVolumes: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_LIST_DOCKER_VOLUMES),
  removeDockerVolumes: (volumeNames: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DISK_REMOVE_DOCKER_VOLUMES, volumeNames),
  getDockerBuildCache: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_GET_DOCKER_BUILD_CACHE),
  pruneDockerBuildCache: () => ipcRenderer.invoke(IPC_CHANNELS.DISK_PRUNE_DOCKER_BUILD_CACHE),

  // Process
  getTopCpuProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_CPU, limit),
  getTopMemoryProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, limit),
  getAllProcesses: () => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_ALL),
  getNetworkPorts: () => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_PORTS),
  killProcess: (request: { pid: number; name?: string; command?: string; reason?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROCESS_KILL, request),

  // Alerts
  getActiveAlerts: () => ipcRenderer.invoke(IPC_CHANNELS.ALERT_GET_ACTIVE),
  dismissAlert: (alertId: string) => ipcRenderer.invoke(IPC_CHANNELS.ALERT_DISMISS, alertId),
  onAlertFired: createListener(IPC_CHANNELS.EVENT_ALERT_FIRED),

  // Jobs
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_CANCEL, jobId),
  onJobProgress: createListener(IPC_CHANNELS.JOB_PROGRESS),
  onJobCompleted: createListener(IPC_CHANNELS.JOB_COMPLETED),
  onJobFailed: createListener(IPC_CHANNELS.JOB_FAILED),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  getDataPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_DATA_PATH),

  // Dialog
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER),

  // Shell — Finder / Explorer에서 열기
  showInFolder: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, targetPath),
  openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath),
  trashItems: (filePaths: string[], description: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_TRASH_ITEMS, filePaths, description)
}

contextBridge.exposeInMainWorld('systemScope', api)

export type SystemScopeApi = typeof api
