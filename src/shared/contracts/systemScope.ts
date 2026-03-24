import type {
  Alert,
  AlertThresholds,
  AppResult,
  AppUninstallRequest,
  DiskScanResult,
  DuplicateGroup,
  ExtensionGroup,
  GrowthViewResult,
  LargeFile,
  ProcessInfo,
  PortInfo,
  QuickScanFolder,
  RecentGrowthEntry,
  SystemStats,
  TrashItemsRequest,
  TrashResult,
  UserSpaceInfo,
  ShutdownState,
  InstalledApp,
  AppRelatedDataItem,
  AppLeftoverDataItem,
  DockerBuildCacheScanResult,
  DockerContainersScanResult,
  DockerImagesScanResult,
  DockerPruneResult,
  DockerRemoveResult,
  DockerVolumesScanResult,
  AppRemovalResult,
  ProcessKillRequest,
  ProcessKillResult
} from '@shared/types'

export type IpcListener = (callback: (data: unknown) => void) => () => void

export interface SystemScopeSettingsPayload {
  thresholds?: AlertThresholds
  theme?: 'dark' | 'light'
  locale?: 'ko' | 'en'
  snapshotIntervalMin?: number
}

export interface SystemScopeAboutInfo {
  appName: string
  version: string
  author: string
  homepage: string | null
  license: string | null
}

export interface SystemScopeApi {
  logRendererError: (scope: string, message: string, details?: unknown) => Promise<AppResult<boolean>>
  setUnsavedSettingsState: (hasUnsavedSettings: boolean) => Promise<AppResult<boolean>>
  getAboutInfo: () => Promise<AppResult<SystemScopeAboutInfo>>
  openAboutWindow: () => Promise<AppResult<boolean>>
  openHomepage: () => Promise<AppResult<boolean>>

  getSystemStats: () => Promise<AppResult<SystemStats>>
  subscribeSystem: () => Promise<AppResult<boolean>>
  unsubscribeSystem: () => Promise<AppResult<boolean>>
  onSystemUpdate: IpcListener

  scanFolder: (folderPath: string) => Promise<AppResult<{ jobId: string }>>
  invalidateScanCache: (folderPath: string) => Promise<AppResult<boolean>>
  getLargeFiles: (folderPath: string, limit: number) => Promise<AppResult<LargeFile[]>>
  getExtensionBreakdown: (folderPath: string) => Promise<AppResult<ExtensionGroup[]>>
  quickScan: () => Promise<AppResult<QuickScanFolder[]>>
  getUserSpace: () => Promise<AppResult<UserSpaceInfo>>
  findRecentGrowth: (folderPath: string, days: number) => Promise<AppResult<RecentGrowthEntry[]>>
  findDuplicates: (folderPath: string, minSizeKB: number) => Promise<AppResult<DuplicateGroup[]>>
  getGrowthView: (period: string) => Promise<AppResult<GrowthViewResult>>
  findOldFiles: (folderPath: string, olderThanDays: number) => Promise<AppResult<LargeFile[]>>
  trashDiskItems: (request: TrashItemsRequest) => Promise<AppResult<TrashResult>>

  listDockerImages: () => Promise<AppResult<DockerImagesScanResult>>
  removeDockerImages: (imageIds: string[]) => Promise<AppResult<DockerRemoveResult>>
  listDockerContainers: () => Promise<AppResult<DockerContainersScanResult>>
  removeDockerContainers: (containerIds: string[]) => Promise<AppResult<DockerRemoveResult>>
  stopDockerContainers: (containerIds: string[]) => Promise<AppResult<{ affectedIds: string[]; failCount: number; errors: string[]; cancelled: boolean }>>
  listDockerVolumes: () => Promise<AppResult<DockerVolumesScanResult>>
  removeDockerVolumes: (volumeNames: string[]) => Promise<AppResult<DockerRemoveResult>>
  getDockerBuildCache: () => Promise<AppResult<DockerBuildCacheScanResult>>
  pruneDockerBuildCache: () => Promise<AppResult<DockerPruneResult>>

  getTopCpuProcesses: (limit: number) => Promise<AppResult<ProcessInfo[]>>
  getTopMemoryProcesses: (limit: number) => Promise<AppResult<ProcessInfo[]>>
  getAllProcesses: () => Promise<AppResult<ProcessInfo[]>>
  getNetworkPorts: () => Promise<AppResult<PortInfo[]>>
  killProcess: (request: ProcessKillRequest) => Promise<AppResult<ProcessKillResult>>

  listInstalledApps: () => Promise<AppResult<InstalledApp[]>>
  getAppRelatedData: (appId: string) => Promise<AppResult<AppRelatedDataItem[]>>
  listLeftoverAppData: () => Promise<AppResult<AppLeftoverDataItem[]>>
  removeLeftoverAppData: (itemIds: string[]) => Promise<AppResult<{ deletedPaths: string[]; failedPaths: string[] }>>
  uninstallApp: (request: AppUninstallRequest) => Promise<AppResult<AppRemovalResult>>
  openAppLocation: (appId: string) => Promise<AppResult<boolean>>
  openSystemUninstallSettings: () => Promise<AppResult<boolean>>

  getActiveAlerts: () => Promise<AppResult<Alert[]>>
  dismissAlert: (alertId: string) => Promise<AppResult<boolean>>
  onAlertFired: IpcListener
  onShutdownState: IpcListener

  cancelJob: (jobId: string) => Promise<AppResult<boolean>>
  onJobProgress: IpcListener
  onJobCompleted: IpcListener
  onJobFailed: IpcListener

  getSettings: () => Promise<AppResult<Record<string, unknown>>>
  setSettings: (settings: SystemScopeSettingsPayload) => Promise<AppResult<Record<string, unknown>>>
  getDataPath: () => Promise<AppResult<string>>
  getLogPath: () => Promise<AppResult<string>>

  selectFolder: () => Promise<AppResult<string | null>>
  showInFolder: (targetPath: string) => Promise<AppResult<boolean>>
  openPath: (targetPath: string) => Promise<AppResult<boolean>>
}

export type { AlertThresholds, DiskScanResult, ShutdownState }
