import type { AlertSeverity, AlertThresholds, AlertType, SystemStats } from '@shared/types'

const SUSTAINED_WARNING_MS = 60_000
const SUSTAINED_CRITICAL_MS = 30_000

export interface ResourceSignal {
  key: string
  type: AlertType
  severity: AlertSeverity
  value: number
  threshold: number
  message: string
  sustainedMs?: number
}

export function getCpuSignal(stats: SystemStats, thresholds: AlertThresholds): ResourceSignal | null {
  const usage = roundPercent(stats.cpu.usage)
  if (usage >= thresholds.cpuCritical) return signal('cpu', 'cpu', 'critical', usage, thresholds.cpuCritical, SUSTAINED_CRITICAL_MS)
  if (usage >= thresholds.cpuWarning) return signal('cpu', 'cpu', 'warning', usage, thresholds.cpuWarning, SUSTAINED_WARNING_MS)
  return null
}

export function getMemorySignal(stats: SystemStats, thresholds: AlertThresholds): ResourceSignal | null {
  const usage = roundPercent(stats.memory.usage)
  const availableRatio = stats.memory.total > 0 ? stats.memory.available / stats.memory.total : 1
  const swapActive = stats.memory.swapTotal > 0 && stats.memory.swapUsed > 0
  if (usage >= thresholds.memoryCritical || (availableRatio <= 0.05 && swapActive)) {
    return signal('memory', 'memory', 'critical', usage, thresholds.memoryCritical, SUSTAINED_CRITICAL_MS)
  }
  if (usage >= thresholds.memoryWarning && (availableRatio <= 0.15 || swapActive)) {
    return signal('memory', 'memory', 'warning', usage, thresholds.memoryWarning, SUSTAINED_WARNING_MS)
  }
  return null
}

export function getGpuSignal(gpuUsage: number, thresholds: AlertThresholds): ResourceSignal | null {
  const usage = roundPercent(gpuUsage)
  if (usage >= thresholds.gpuMemoryCritical) return signal('gpu', 'gpu', 'critical', usage, thresholds.gpuMemoryCritical, SUSTAINED_CRITICAL_MS)
  if (usage >= thresholds.gpuMemoryWarning) return signal('gpu', 'gpu', 'warning', usage, thresholds.gpuMemoryWarning, SUSTAINED_WARNING_MS)
  return null
}

function signal(key: string, type: AlertType, severity: AlertSeverity, value: number, threshold: number, sustainedMs: number): ResourceSignal {
  return { key, type, severity, value, threshold, sustainedMs, message: '' }
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10
}
