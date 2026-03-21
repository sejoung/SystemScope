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

  // Process
  getTopCpuProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_CPU, limit),
  getTopMemoryProcesses: (limit: number) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_TOP_MEMORY, limit),
  getAllProcesses: () => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_GET_ALL),

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
  openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath)
}

contextBridge.exposeInMainWorld('systemScope', api)

export type SystemScopeApi = typeof api
