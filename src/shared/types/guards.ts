import type { DiskScanResult, DockerContainersScanResult, QuickScanFolder } from './disk'
import type { PortInfo, ProcessSnapshot } from './process'
import type { InstalledApp, AppRelatedDataItem, AppRemovalResult, AppLeftoverDataItem, AppLeftoverRegistryItem } from './apps'
import type { SystemStats } from './system'
import type { Alert } from './alert'
import type { ShutdownState } from './shutdown'
import type { UpdateInfo, UpdateStatus } from './update'
import type { MetricPoint, TimelineData } from './metric'
import type { SystemEvent } from './event'
import type { DiagnosisResult, DiagnosisSummary, AlertIntelligence } from './diagnosis'
import type { CleanupPreview, CleanupResult, CleanupInbox } from './automation'
import type { WorkspaceProfile } from './profile'
import { DASHBOARD_WIDGET_KEYS } from './profile'
import type { ToolIntegrationResult, ToolCleanResult } from './toolIntegration'
import type { StartupItem, StartupToggleResult } from './startup'
import type { ProjectMonitorSummary } from './projectMonitor'

// ── IPC 응답 런타임 타입 가드 ──

function isObj(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === 'object'
}

/** job progress */
export function isJobProgress(data: unknown): data is { id: string; currentStep: string } {
  return isObj(data) && typeof data.id === 'string' && typeof data.currentStep === 'string'
}

/** job completed (data 필드에 DiskScanResult) */
export function isJobCompleted(data: unknown): data is { id: string; data: DiskScanResult } {
  return isObj(data) && typeof data.id === 'string' && 'data' in data
}

/** job failed */
export function isJobFailed(data: unknown): data is { id: string; error: string } {
  return isObj(data) && typeof data.id === 'string' && typeof data.error === 'string'
}

/** DockerContainersScanResult */
export function isDockerContainersScanResult(data: unknown): data is DockerContainersScanResult {
  return isObj(data) && 'status' in data && 'containers' in data
}

/** PortInfo[] — first-element sampling: validates only data[0] for performance */
export function isPortInfoArray(data: unknown): data is PortInfo[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && typeof data[0].localPort === 'string' && typeof data[0].protocol === 'string'))
}

/** InstalledApp[] — first-element sampling: validates only data[0] for performance */
export function isInstalledAppArray(data: unknown): data is InstalledApp[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && typeof data[0].id === 'string' && typeof data[0].name === 'string' && typeof data[0].platform === 'string'))
}

/** AppRelatedDataItem[] — first-element sampling: validates only data[0] for performance */
export function isAppRelatedDataArray(data: unknown): data is AppRelatedDataItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'id' in data[0] && 'label' in data[0] && 'path' in data[0]))
}

/** AppRemovalResult */
export function isAppRemovalResult(data: unknown): data is AppRemovalResult {
  return isObj(data) && 'id' in data && 'started' in data && 'completed' in data && 'cancelled' in data
}

/** QuickScanFolder[] — first-element sampling: validates only data[0] for performance */
export function isQuickScanFolderArray(data: unknown): data is QuickScanFolder[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'category' in data[0] && 'cleanable' in data[0]))
}

/** AppLeftoverDataItem[] — first-element sampling: validates only data[0] for performance */
export function isAppLeftoverDataArray(data: unknown): data is AppLeftoverDataItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'appName' in data[0] && 'confidence' in data[0]))
}

/** AppLeftoverRegistryItem[] — first-element sampling: validates only data[0] for performance */
export function isAppLeftoverRegistryArray(data: unknown): data is AppLeftoverRegistryItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'registryPath' in data[0]))
}

/** SystemStats */
export function isSystemStats(data: unknown): data is SystemStats {
  return isObj(data) && 'cpu' in data && 'memory' in data && 'disk' in data && typeof data.timestamp === 'number'
    && isObj(data.cpu) && typeof (data.cpu as Record<string, unknown>).usage === 'number'
    && isObj(data.memory) && typeof (data.memory as Record<string, unknown>).total === 'number'
}

/** Alert[] */
export function isAlertArray(data: unknown): data is Alert[] {
  return Array.isArray(data) && data.every((item) => isObj(item) && 'id' in item && 'type' in item)
}

/** ShutdownState */
export function isShutdownState(data: unknown): data is ShutdownState {
  return isObj(data) && 'phase' in data && 'message' in data
}

/** UpdateInfo */
export function isUpdateInfo(data: unknown): data is UpdateInfo {
  return isObj(data) && 'latestVersion' in data && 'releaseUrl' in data
}

/** UpdateStatus */
export function isUpdateStatus(data: unknown): data is UpdateStatus {
  return isObj(data) && 'currentVersion' in data && 'checking' in data && 'lastCheckedAt' in data
}

/** ProcessSnapshot */
export function isProcessSnapshot(data: unknown): data is ProcessSnapshot {
  return isObj(data) && Array.isArray(data.allProcesses) && Array.isArray(data.topCpuProcesses) && Array.isArray(data.topMemoryProcesses)
}

/** MetricPoint */
export function isMetricPoint(data: unknown): data is MetricPoint {
  return isObj(data) && typeof data.ts === 'number' && typeof data.cpu === 'number' && typeof data.memory === 'number'
    && typeof data.memoryUsedBytes === 'number' && typeof data.memoryTotalBytes === 'number'
}

/** TimelineData */
export function isTimelineData(data: unknown): data is TimelineData {
  return isObj(data) && typeof data.range === 'string' && Array.isArray(data.points) && Array.isArray(data.alerts)
}

/** SystemEvent */
export function isSystemEvent(data: unknown): data is SystemEvent {
  return isObj(data) && typeof data.id === 'string' && typeof data.ts === 'number' && typeof data.category === 'string' && typeof data.severity === 'string' && typeof data.title === 'string'
}

/** SystemEvent[] — first-element sampling: validates only data[0] for performance */
export function isSystemEventArray(data: unknown): data is SystemEvent[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && typeof data[0].id === 'string' && typeof data[0].ts === 'number' && typeof data[0].category === 'string'))
}

/** DiagnosisResult */
export function isDiagnosisResult(data: unknown): data is DiagnosisResult {
  return isObj(data) && typeof data.id === 'string' && typeof data.category === 'string' && typeof data.severity === 'string'
    && typeof data.title === 'string' && typeof data.description === 'string' && Array.isArray(data.evidence) && Array.isArray(data.actions)
    && typeof data.detectedAt === 'number'
}

/** DiagnosisSummary */
export function isDiagnosisSummary(data: unknown): data is DiagnosisSummary {
  return isObj(data) && Array.isArray(data.results) && typeof data.analyzedAt === 'number'
}

/** AlertIntelligence */
export function isAlertIntelligence(data: unknown): data is AlertIntelligence {
  return isObj(data) && Array.isArray(data.activeAlerts) && Array.isArray(data.patterns) && Array.isArray(data.sustainedAlerts)
}

/** CleanupPreview */
export function isCleanupPreview(data: unknown): data is CleanupPreview {
  return isObj(data) && Array.isArray(data.items) && typeof data.totalSize === 'number' && Array.isArray(data.ruleBreakdown) && typeof data.scannedAt === 'number'
}

/** CleanupResult */
export function isCleanupResult(data: unknown): data is CleanupResult {
  return isObj(data) && typeof data.deletedCount === 'number' && typeof data.deletedSize === 'number' && typeof data.failedCount === 'number' && Array.isArray(data.failedPaths) && typeof data.completedAt === 'number'
}

/** CleanupInbox */
export function isCleanupInbox(data: unknown): data is CleanupInbox {
  return isObj(data) && Array.isArray(data.items) && typeof data.totalReclaimable === 'number' && typeof data.generatedAt === 'number'
}

/** DiagnosticReportData */
export function isDiagnosticReportData(data: unknown): data is import('./report').DiagnosticReportData {
  return isObj(data) && typeof data.generatedAt === 'number' && typeof data.appVersion === 'string' && Array.isArray(data.sections)
}

/** SessionSnapshot */
export function isSessionSnapshot(data: unknown): data is import('./sessionSnapshot').SessionSnapshot {
  return isObj(data) && typeof data.id === 'string' && typeof data.label === 'string' && typeof data.timestamp === 'number' && isObj(data.system)
}

/** SessionSnapshot[] */
export function isSessionSnapshotArray(data: unknown): data is import('./sessionSnapshot').SessionSnapshot[] {
  return Array.isArray(data) && (data.length === 0 || isSessionSnapshot(data[0]))
}

/** SnapshotDiff */
export function isSnapshotDiff(data: unknown): data is import('./sessionSnapshot').SnapshotDiff {
  return isObj(data) && isObj(data.snapshot1) && isObj(data.snapshot2) && isObj(data.system) && isObj(data.processChanges) && isObj(data.alertChanges)
}

/** WorkspaceProfile */
export function isWorkspaceProfile(data: unknown): data is WorkspaceProfile {
  if (!isObj(data)) return false
  if (typeof data.id !== 'string' || !data.id) return false
  if (typeof data.name !== 'string' || !data.name) return false
  if (typeof data.icon !== 'string') return false
  if (!isObj(data.thresholds)) return false
  if (!Array.isArray(data.cleanupRules)) return false
  if (!Array.isArray(data.hiddenWidgets)) return false
  if (!Array.isArray(data.workspacePaths) || !data.workspacePaths.every((entry) => typeof entry === 'string')) return false
  if (!(data.automationSchedule === null || (isObj(data.automationSchedule) && typeof data.automationSchedule.enabled === 'boolean' && typeof data.automationSchedule.frequency === 'string'))) return false
  const validWidgetKeys = new Set<string>(DASHBOARD_WIDGET_KEYS)
  for (const key of data.hiddenWidgets as unknown[]) {
    if (typeof key !== 'string' || !validWidgetKeys.has(key)) return false
  }
  return true
}

/** WorkspaceProfile[] — first-element sampling */
export function isWorkspaceProfileArray(data: unknown): data is WorkspaceProfile[] {
  return Array.isArray(data) && (data.length === 0 || isWorkspaceProfile(data[0]))
}

/** ToolIntegrationResult */
export function isToolIntegrationResult(data: unknown): data is ToolIntegrationResult {
  return isObj(data) && typeof data.tool === 'string' && typeof data.status === 'string' && Array.isArray(data.summary) && Array.isArray(data.reclaimable) && typeof data.lastScannedAt === 'number'
}

/** ToolIntegrationResult[] — first-element sampling */
export function isToolIntegrationResultArray(data: unknown): data is ToolIntegrationResult[] {
  return Array.isArray(data) && (data.length === 0 || isToolIntegrationResult(data[0]))
}

/** ToolCleanResult */
export function isToolCleanResult(data: unknown): data is ToolCleanResult {
  return isObj(data) && Array.isArray(data.succeeded) && Array.isArray(data.failed)
}

/** StartupItem */
export function isStartupItem(data: unknown): data is StartupItem {
  return isObj(data) && typeof data.id === 'string' && typeof data.name === 'string' && typeof data.path === 'string' && typeof data.enabled === 'boolean'
}

/** StartupItem[] — first-element sampling */
export function isStartupItemArray(data: unknown): data is StartupItem[] {
  return Array.isArray(data) && (data.length === 0 || isStartupItem(data[0]))
}

/** StartupToggleResult */
export function isStartupToggleResult(data: unknown): data is StartupToggleResult {
  return isObj(data) && typeof data.id === 'string' && typeof data.success === 'boolean'
}

export function isProjectMonitorSummary(data: unknown): data is ProjectMonitorSummary {
  return isObj(data)
    && Array.isArray(data.workspaces)
    && typeof data.totalSize === 'number'
    && typeof data.totalRecentGrowthBytes === 'number'
    && typeof data.scannedAt === 'number'
}
