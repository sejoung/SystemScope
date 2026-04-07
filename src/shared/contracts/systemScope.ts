import type {
  Alert,
  AlertThresholds,
  AlertHistoryEntry,
  AlertIntelligence,
  AppResult,
  AppUninstallRequest,
  CleanupInbox,
  CleanupPreview,
  CleanupResult,
  CleanupRule,
  CleanupRuleConfig,
  DiagnosisSummary,
  DiskScanResult,
  DuplicateGroup,
  ExtensionGroup,
  GrowthViewResult,
  LargeFile,
  ProcessSnapshot,
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
  AppLeftoverRegistryItem,
  DockerBuildCacheScanResult,
  DockerContainersScanResult,
  DockerImagesScanResult,
  DockerPruneResult,
  DockerRemoveResult,
  DockerVolumesScanResult,
  AppRemovalResult,
  ProcessKillRequest,
  ProcessKillResult,
  UpdateStatus,
  AppSettings,
  AppSettingsPatch,
  TimelineRange,
  TimelineData,
  MetricPointDetail,
  SystemEvent,
  EventQueryOptions,
  ReportOptions,
  DiagnosticReportData,
  SaveReportOptions,
  SessionSnapshot,
  SnapshotDiff,
  WorkspaceProfile,
  ToolIntegrationResult,
  ToolCleanResult,
  StartupItem,
  StartupToggleResult,
  ProjectMonitorSummary,
  DevToolsOverview,
  ProcessNetworkSnapshot
} from '@shared/types'

export type IpcListener = (callback: (data: unknown) => void) => () => void

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
  checkForUpdate: () => Promise<AppResult<UpdateStatus>>
  getUpdateStatus: () => Promise<AppResult<UpdateStatus>>
  openUpdateRelease: (releaseUrl: string) => Promise<AppResult<boolean>>
  onUpdateAvailable: IpcListener

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
  getProcessSnapshot: (limit: number) => Promise<AppResult<ProcessSnapshot>>
  getNetworkPorts: () => Promise<AppResult<PortInfo[]>>
  getNetworkUsage: () => Promise<AppResult<ProcessNetworkSnapshot>>
  resolveHostnames: (ips: string[]) => Promise<AppResult<Record<string, string | null>>>
  killProcess: (request: ProcessKillRequest) => Promise<AppResult<ProcessKillResult>>

  listInstalledApps: () => Promise<AppResult<InstalledApp[]>>
  getAppRelatedData: (appId: string) => Promise<AppResult<AppRelatedDataItem[]>>
  listLeftoverAppData: () => Promise<AppResult<AppLeftoverDataItem[]>>
  hydrateLeftoverAppDataSizes: (itemIds: string[]) => Promise<AppResult<AppLeftoverDataItem[]>>
  removeLeftoverAppData: (itemIds: string[]) => Promise<AppResult<{ deletedPaths: string[]; failedPaths: string[] }>>
  listLeftoverAppRegistry: () => Promise<AppResult<AppLeftoverRegistryItem[]>>
  removeLeftoverAppRegistry: (itemIds: string[]) => Promise<AppResult<{ deletedKeys: string[]; failedKeys: string[] }>>
  uninstallApp: (request: AppUninstallRequest) => Promise<AppResult<AppRemovalResult>>
  openAppLocation: (appId: string) => Promise<AppResult<boolean>>
  openSystemUninstallSettings: () => Promise<AppResult<boolean>>

  getActiveAlerts: () => Promise<AppResult<Alert[]>>
  dismissAlert: (alertId: string) => Promise<AppResult<boolean>>
  getAlertIntelligence: () => Promise<AppResult<AlertIntelligence>>
  getAlertHistory: (limit?: number) => Promise<AppResult<AlertHistoryEntry[]>>
  getDiagnosisSummary: () => Promise<AppResult<DiagnosisSummary>>
  onAlertFired: IpcListener
  onShutdownState: IpcListener

  cancelJob: (jobId: string) => Promise<AppResult<boolean>>
  onJobProgress: IpcListener
  onJobCompleted: IpcListener
  onJobFailed: IpcListener

  getSettings: () => Promise<AppResult<AppSettings>>
  setSettings: (settings: AppSettingsPatch) => Promise<AppResult<AppSettings>>
  getDataPath: () => Promise<AppResult<string>>
  getSystemLogPath: () => Promise<AppResult<string>>
  getAccessLogPath: () => Promise<AppResult<string>>

  selectFolder: () => Promise<AppResult<string | null>>
  showInFolder: (targetPath: string) => Promise<AppResult<boolean>>
  openPath: (targetPath: string) => Promise<AppResult<boolean>>

  getTimelineData: (range: TimelineRange) => Promise<AppResult<TimelineData>>
  getTimelinePointDetail: (timestamp: number) => Promise<AppResult<MetricPointDetail>>
  getEventHistory: (options?: EventQueryOptions) => Promise<AppResult<SystemEvent[]>>
  getRecentEvents: (count?: number) => Promise<AppResult<SystemEvent[]>>

  getCleanupRules: () => Promise<AppResult<CleanupRule[]>>
  setCleanupRuleConfig: (config: CleanupRuleConfig) => Promise<AppResult<void>>
  previewCleanup: () => Promise<AppResult<CleanupPreview>>
  executeCleanup: (paths: string[]) => Promise<AppResult<CleanupResult>>
  getCleanupInbox: () => Promise<AppResult<CleanupInbox>>
  dismissCleanupItem: (path: string) => Promise<AppResult<void>>

  buildDiagnosticReport: (options: ReportOptions) => Promise<AppResult<DiagnosticReportData>>
  saveDiagnosticReport: (options: SaveReportOptions) => Promise<AppResult<{ filePath: string }>>

  saveSessionSnapshot: (label?: string) => Promise<AppResult<SessionSnapshot>>
  getSessionSnapshots: () => Promise<AppResult<SessionSnapshot[]>>
  deleteSessionSnapshot: (id: string) => Promise<AppResult<boolean>>
  getSessionSnapshotDiff: (id1: string, id2: string) => Promise<AppResult<SnapshotDiff>>

  getStartupItems: () => Promise<AppResult<StartupItem[]>>
  toggleStartupItem: (id: string, enabled: boolean) => Promise<AppResult<StartupToggleResult>>

  scanDevTools: () => Promise<AppResult<ToolIntegrationResult[]>>
  cleanDevToolItems: (paths: string[]) => Promise<AppResult<ToolCleanResult>>
  getDevToolsOverview: (options?: { forceRefresh?: boolean }) => Promise<AppResult<DevToolsOverview>>

  getProfiles: () => Promise<AppResult<WorkspaceProfile[]>>
  saveProfile: (profile: WorkspaceProfile) => Promise<AppResult<WorkspaceProfile>>
  deleteProfile: (id: string) => Promise<AppResult<boolean>>
  setActiveProfile: (id: string | null) => Promise<AppResult<WorkspaceProfile | null>>
  getProjectMonitorSummary: () => Promise<AppResult<ProjectMonitorSummary>>
}

export type { AlertThresholds, DiskScanResult, ShutdownState }
