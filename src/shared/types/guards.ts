import type { DiskScanResult, DockerContainersScanResult, QuickScanFolder } from './disk'
import type { PortInfo, ProcessSnapshot } from './process'
import type { InstalledApp, AppRelatedDataItem, AppRemovalResult, AppLeftoverDataItem, AppLeftoverRegistryItem } from './apps'
import type { SystemStats } from './system'
import type { Alert } from './alert'
import type { ShutdownState } from './shutdown'
import type { UpdateInfo, UpdateStatus } from './update'

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

/** PortInfo[] */
export function isPortInfoArray(data: unknown): data is PortInfo[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'localPort' in data[0] && 'protocol' in data[0]))
}

/** InstalledApp[] */
export function isInstalledAppArray(data: unknown): data is InstalledApp[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'id' in data[0] && 'name' in data[0] && 'platform' in data[0]))
}

/** AppRelatedDataItem[] */
export function isAppRelatedDataArray(data: unknown): data is AppRelatedDataItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'id' in data[0] && 'label' in data[0] && 'path' in data[0]))
}

/** AppRemovalResult */
export function isAppRemovalResult(data: unknown): data is AppRemovalResult {
  return isObj(data) && 'id' in data && 'started' in data && 'completed' in data && 'cancelled' in data
}

/** QuickScanFolder[] */
export function isQuickScanFolderArray(data: unknown): data is QuickScanFolder[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'category' in data[0] && 'cleanable' in data[0]))
}

/** AppLeftoverDataItem[] */
export function isAppLeftoverDataArray(data: unknown): data is AppLeftoverDataItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'appName' in data[0] && 'confidence' in data[0]))
}

/** AppLeftoverRegistryItem[] */
export function isAppLeftoverRegistryArray(data: unknown): data is AppLeftoverRegistryItem[] {
  return Array.isArray(data) && (data.length === 0 || (isObj(data[0]) && 'registryPath' in data[0]))
}

/** SystemStats */
export function isSystemStats(data: unknown): data is SystemStats {
  return isObj(data) && 'cpu' in data && 'memory' in data && 'timestamp' in data
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
  return isObj(data) && 'allProcesses' in data && 'topCpuProcesses' in data && 'topMemoryProcesses' in data
}
