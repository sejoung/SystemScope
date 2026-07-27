import type { ProcessInfo } from '@shared/types'

export const DEFAULT_LONG_RUNNING_THRESHOLD_MS = 10 * 60 * 1000
export const CURRENT_HIGH_CPU_THRESHOLD = 80
export const SUSTAINED_CPU_THRESHOLD = 50
export const MIN_SUSTAINED_CPU_OBSERVATION_MS = 60 * 1000

export type ProcessAnomalyKind =
  | 'zombie'
  | 'sustained_cpu'
  | 'high_cpu'
  | 'long_running'

export interface ProcessAnomalyEntry {
  process: ProcessInfo
  kinds: ProcessAnomalyKind[]
  riskScore: number
  systemProcess: boolean
}

export function isZombieProcess(processInfo: ProcessInfo): boolean {
  const state = processInfo.state.trim().toLowerCase()
  return state === 'zombie' || state === 'z'
}

export function isLikelySystemProcess(processInfo: ProcessInfo): boolean {
  if (processInfo.pid <= 1) return true

  const user = processInfo.user.trim().toLowerCase()
  return user === 'root'
    || user.startsWith('_')
    || user === 'system'
    || user.endsWith('\\system')
    || user.endsWith('\\local service')
    || user.endsWith('\\network service')
}

export function getProcessAnomalyKinds(
  processInfo: ProcessInfo,
  longRunningThresholdMs: number
): ProcessAnomalyKind[] {
  const kinds: ProcessAnomalyKind[] = []

  if (isZombieProcess(processInfo)) {
    kinds.push('zombie')
  }

  if (
    processInfo.cpuAverage5m !== null
    && processInfo.cpuObservedMs >= MIN_SUSTAINED_CPU_OBSERVATION_MS
    && processInfo.cpuAverage5m >= SUSTAINED_CPU_THRESHOLD
  ) {
    kinds.push('sustained_cpu')
  } else if (processInfo.cpu >= CURRENT_HIGH_CPU_THRESHOLD) {
    kinds.push('high_cpu')
  }

  if (
    processInfo.uptimeMs !== null
    && processInfo.uptimeMs >= longRunningThresholdMs
  ) {
    kinds.push('long_running')
  }

  return kinds
}

export function getProcessAnomalyEntries(
  processes: ProcessInfo[],
  longRunningThresholdMs: number,
  includeSystemProcesses: boolean
): ProcessAnomalyEntry[] {
  const entries: ProcessAnomalyEntry[] = []

  for (const processInfo of processes) {
    const kinds = getProcessAnomalyKinds(processInfo, longRunningThresholdMs)
    if (kinds.length === 0) continue

    const systemProcess = isLikelySystemProcess(processInfo)
    const hasOperationalAnomaly = kinds.some((kind) => kind !== 'long_running')
    if (!includeSystemProcesses && systemProcess && !hasOperationalAnomaly) {
      continue
    }

    entries.push({
      process: processInfo,
      kinds,
      systemProcess,
      riskScore: getRiskScore(processInfo, kinds)
    })
  }

  return entries.sort((left, right) =>
    right.riskScore - left.riskScore
    || (right.process.uptimeMs ?? 0) - (left.process.uptimeMs ?? 0)
    || right.process.cpu - left.process.cpu
  )
}

function getRiskScore(
  processInfo: ProcessInfo,
  kinds: ProcessAnomalyKind[]
): number {
  let score = 0
  if (kinds.includes('zombie')) score += 4_000
  if (kinds.includes('sustained_cpu')) score += 3_000
  if (kinds.includes('high_cpu')) score += 2_000
  if (kinds.includes('long_running')) {
    score += 1_000 + Math.min(900, (processInfo.uptimeMs ?? 0) / 3_600_000)
  }
  return score
}

export function formatProcessDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—'

  const totalMinutes = Math.floor(ms / 60_000)
  if (totalMinutes < 1) return '< 1m'
  if (totalMinutes < 60) return `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}
