import { randomUUID } from 'node:crypto'
import type { Alert, AlertThresholds, AlertType, AlertSeverity, SystemStats } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import { ALERT_COOLDOWN_MS, MAX_ACTIVE_ALERTS } from '@shared/constants/thresholds'
import { formatBytes } from '@shared/utils/formatBytes'
import { tk } from '../../i18n'
import { onAlertFired, onAlertResolved } from './alertHistory'

let thresholds: AlertThresholds = { ...DEFAULT_THRESHOLDS }
const activeAlerts: Map<string, Alert> = new Map()
const lastFired: Map<string, number> = new Map()
const activeAlertTypes = new Set<string>()
const activeAlertIdsByKey = new Map<string, string>()
const alertKeysById = new Map<string, string>()

const SUSTAINED_WARNING_MS = 60_000
const SUSTAINED_CRITICAL_MS = 30_000
const RESOURCE_RECOVERY_MS = 60_000
const DISK_WARNING_AVAILABLE_BYTES = 50 * 1024 * 1024 * 1024
const DISK_CRITICAL_AVAILABLE_BYTES = 10 * 1024 * 1024 * 1024

interface ResourceState {
  severity: AlertSeverity
  firstBreachedAt: number
  maxValue: number
  recoveryStartedAt: number | null
}

interface ResourceSignal {
  key: string
  type: AlertType
  severity: AlertSeverity
  value: number
  threshold: number
  message: string
  sustainedMs?: number
}

const resourceStates = new Map<string, ResourceState>()

export function setThresholds(newThresholds: Partial<AlertThresholds>): void {
  thresholds = { ...thresholds, ...newThresholds }
}

export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values())
}

export function dismissAlert(id: string): boolean {
  const deleted = activeAlerts.delete(id)
  if (!deleted) {
    return false
  }

  const key = alertKeysById.get(id)
  if (key) {
    alertKeysById.delete(id)
    if (activeAlertIdsByKey.get(key) === id) {
      activeAlertIdsByKey.delete(key)
    }
  }
  return true
}

export function checkAlerts(stats: SystemStats): Alert[] {
  // Evict expired entries from lastFired to prevent unbounded growth
  const now = Date.now()
  for (const [key, timestamp] of lastFired) {
    if (now - timestamp > ALERT_COOLDOWN_MS) {
      lastFired.delete(key)
    }
  }

  const newAlerts: Alert[] = []

  // CPU 알림
  const cpuAlert = evaluateSustainedSignal('cpu', getCpuSignal(stats), stats.cpu.usage, thresholds.cpuWarning - 10)
  if (cpuAlert) newAlerts.push(cpuAlert)

  // 디스크 알림 — macOS에서는 purgeable 제외한 realUsage 기준으로 판단
  for (const drive of stats.disk.drives) {
    const diskAlert = evaluateImmediateSignal(getDiskSignal(drive))
    if (diskAlert) newAlerts.push(diskAlert)
  }

  // 메모리 알림
  const memoryAlert = evaluateSustainedSignal('memory', getMemorySignal(stats), stats.memory.usage, thresholds.memoryWarning - 10)
  if (memoryAlert) newAlerts.push(memoryAlert)

  // GPU 메모리 알림
  if (stats.gpu.available && stats.gpu.memoryTotal && stats.gpu.memoryUsed) {
    const gpuUsage = Math.round((stats.gpu.memoryUsed / stats.gpu.memoryTotal) * 10000) / 100
    const gpuAlert = evaluateSustainedSignal('gpu', getGpuSignal(gpuUsage), gpuUsage, thresholds.gpuMemoryWarning - 10)
    if (gpuAlert) newAlerts.push(gpuAlert)
  } else {
    updateRecovery('gpu', 0, thresholds.gpuMemoryWarning - 10)
  }

  return newAlerts
}

function getCpuSignal(stats: SystemStats): ResourceSignal | null {
  const usage = roundPercent(stats.cpu.usage)
  if (usage >= thresholds.cpuCritical) {
    return {
      key: 'cpu',
      type: 'cpu',
      severity: 'critical',
      value: usage,
      threshold: thresholds.cpuCritical,
      sustainedMs: SUSTAINED_CRITICAL_MS,
      message: ''
    }
  }
  if (usage >= thresholds.cpuWarning) {
    return {
      key: 'cpu',
      type: 'cpu',
      severity: 'warning',
      value: usage,
      threshold: thresholds.cpuWarning,
      sustainedMs: SUSTAINED_WARNING_MS,
      message: ''
    }
  }
  return null
}

function getMemorySignal(stats: SystemStats): ResourceSignal | null {
  const usage = roundPercent(stats.memory.usage)
  const availableRatio = stats.memory.total > 0 ? stats.memory.available / stats.memory.total : 1
  const swapActive = stats.memory.swapTotal > 0 && stats.memory.swapUsed > 0
  const warningPressure = usage >= thresholds.memoryWarning && (availableRatio <= 0.15 || swapActive)
  const criticalPressure = usage >= thresholds.memoryCritical || (availableRatio <= 0.05 && swapActive)

  if (criticalPressure) {
    return {
      key: 'memory',
      type: 'memory',
      severity: 'critical',
      value: usage,
      threshold: thresholds.memoryCritical,
      sustainedMs: SUSTAINED_CRITICAL_MS,
      message: ''
    }
  }
  if (warningPressure) {
    return {
      key: 'memory',
      type: 'memory',
      severity: 'warning',
      value: usage,
      threshold: thresholds.memoryWarning,
      sustainedMs: SUSTAINED_WARNING_MS,
      message: ''
    }
  }
  return null
}

function getGpuSignal(gpuUsage: number): ResourceSignal | null {
  const usage = roundPercent(gpuUsage)
  if (usage >= thresholds.gpuMemoryCritical) {
    return {
      key: 'gpu',
      type: 'gpu',
      severity: 'critical',
      value: usage,
      threshold: thresholds.gpuMemoryCritical,
      sustainedMs: SUSTAINED_CRITICAL_MS,
      message: ''
    }
  }
  if (usage >= thresholds.gpuMemoryWarning) {
    return {
      key: 'gpu',
      type: 'gpu',
      severity: 'warning',
      value: usage,
      threshold: thresholds.gpuMemoryWarning,
      sustainedMs: SUSTAINED_WARNING_MS,
      message: ''
    }
  }
  return null
}

function getDiskSignal(drive: SystemStats['disk']['drives'][number]): ResourceSignal | null {
  if (isNonActionableSystemVolume(drive.mount)) {
    return null
  }

  const usage = roundPercent(drive.realUsage ?? drive.usage)
  const available = drive.available
  const key = `disk:${drive.mount}`
  const critical = usage >= thresholds.diskCritical || (usage >= thresholds.diskWarning && available <= DISK_CRITICAL_AVAILABLE_BYTES)
  const warning = usage >= thresholds.diskWarning && available <= DISK_WARNING_AVAILABLE_BYTES

  if (critical) {
    return {
      key,
      type: 'disk',
      severity: 'critical',
      value: usage,
      threshold: thresholds.diskCritical,
      message: tk('main.alert.message.disk_low_space_critical', {
        mount: drive.mount,
        usage,
        available: formatBytes(available)
      })
    }
  }
  if (warning) {
    return {
      key,
      type: 'disk',
      severity: 'warning',
      value: usage,
      threshold: thresholds.diskWarning,
      message: tk('main.alert.message.disk_low_space_warning', {
        mount: drive.mount,
        usage,
        available: formatBytes(available)
      })
    }
  }
  updateRecovery(key, usage, thresholds.diskWarning - 10)
  return null
}

function isNonActionableSystemVolume(mount: string): boolean {
  if (!mount.startsWith('/System/Volumes/')) {
    return false
  }

  return mount !== '/System/Volumes/Data'
}

function evaluateSustainedSignal(key: string, signal: ResourceSignal | null, currentValue: number, recoveryThreshold: number): Alert | null {
  if (!signal) {
    return updateRecovery(key, currentValue, recoveryThreshold)
  }

  const now = Date.now()
  const existing = resourceStates.get(signal.key)
  const state = !existing || existing.severity !== signal.severity
    ? {
        severity: signal.severity,
        firstBreachedAt: now,
        maxValue: signal.value,
        recoveryStartedAt: null
      }
    : {
        ...existing,
        maxValue: Math.max(existing.maxValue, signal.value),
        recoveryStartedAt: null
      }
  resourceStates.set(signal.key, state)

  const sustainedForMs = now - state.firstBreachedAt
  const requiredMs = signal.sustainedMs ?? SUSTAINED_WARNING_MS
  if (sustainedForMs < requiredMs) {
    return null
  }

  return createAlertIfCooldown(
    signal.key,
    signal.type,
    signal.severity,
    buildSustainedMessage(signal, state.maxValue, sustainedForMs),
    signal.value,
    signal.threshold
  )
}

function evaluateImmediateSignal(signal: ResourceSignal | null): Alert | null {
  if (!signal) {
    return null
  }

  resourceStates.set(signal.key, {
    severity: signal.severity,
    firstBreachedAt: Date.now(),
    maxValue: signal.value,
    recoveryStartedAt: null
  })

  return createAlertIfCooldown(
    signal.key,
    signal.type,
    signal.severity,
    signal.message,
    signal.value,
    signal.threshold
  )
}

function updateRecovery(key: string, value: number, recoveryThreshold: number): null {
  if (!key) {
    return null
  }

  const state = resourceStates.get(key)
  if (!state) {
    return null
  }

  if (value > recoveryThreshold) {
    state.recoveryStartedAt = null
    resourceStates.set(key, state)
    return null
  }

  const now = Date.now()
  if (state.recoveryStartedAt === null) {
    state.recoveryStartedAt = now
    resourceStates.set(key, state)
    return null
  }

  if (now - state.recoveryStartedAt >= RESOURCE_RECOVERY_MS) {
    resourceStates.delete(key)
    resolveResourceAlert(key)
  }
  return null
}

function buildSustainedMessage(signal: ResourceSignal, peakValue: number, sustainedForMs: number): string {
  const duration = formatDuration(sustainedForMs)
  if (signal.type === 'cpu') {
    return tk('main.alert.message.cpu_sustained', {
      duration,
      usage: signal.value,
      peak: roundPercent(peakValue)
    })
  }
  if (signal.type === 'memory') {
    return tk('main.alert.message.memory_sustained', {
      duration,
      usage: signal.value,
      peak: roundPercent(peakValue)
    })
  }
  return tk('main.alert.message.gpu_memory_sustained', {
    duration,
    usage: signal.value,
    peak: roundPercent(peakValue)
  })
}

function createAlertIfCooldown(
  key: string,
  type: AlertType,
  severity: AlertSeverity,
  message: string,
  value: number,
  threshold: number
): Alert | null {
  const now = Date.now()
  const activeId = activeAlertIdsByKey.get(key)
  const active = activeId ? activeAlerts.get(activeId) : null
  if (active?.severity === severity) {
    return null
  }

  const cooldownKey = `${key}:${severity}`
  const last = lastFired.get(cooldownKey)
  if (last && now - last < ALERT_COOLDOWN_MS) return null

  lastFired.set(cooldownKey, now)

  if (activeId) {
    activeAlerts.delete(activeId)
    activeAlertIdsByKey.delete(key)
    alertKeysById.delete(activeId)
  }

  // 최대 알림 수 초과 시 가장 오래된 알림 제거
  if (activeAlerts.size >= MAX_ACTIVE_ALERTS) {
    const oldestKey = activeAlerts.keys().next().value
    if (oldestKey !== undefined) {
      activeAlerts.delete(oldestKey)
      const resourceKey = alertKeysById.get(oldestKey)
      if (resourceKey && activeAlertIdsByKey.get(resourceKey) === oldestKey) {
        activeAlertIdsByKey.delete(resourceKey)
      }
      alertKeysById.delete(oldestKey)
    }
  }

  const id = `alert-${randomUUID()}`
  const alert: Alert = { id, type, severity, message, value, threshold, timestamp: now, dismissed: false }
  activeAlerts.set(id, alert)
  activeAlertIdsByKey.set(key, id)
  alertKeysById.set(id, key)

  if (!activeAlertTypes.has(key)) {
    activeAlertTypes.add(key)
    onAlertFired(key, severity, message)
  } else if (active?.severity !== severity) {
    onAlertResolved(key)
    onAlertFired(key, severity, message)
  }

  return alert
}

function resolveResourceAlert(key: string): void {
  const activeId = activeAlertIdsByKey.get(key)
  if (activeId) {
    activeAlerts.delete(activeId)
    activeAlertIdsByKey.delete(key)
    alertKeysById.delete(activeId)
  }

  if (activeAlertTypes.has(key)) {
    activeAlertTypes.delete(key)
    onAlertResolved(key)
  }
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) {
    return tk('main.alert.duration.seconds', { count: seconds })
  }

  const minutes = Math.max(1, Math.round(seconds / 60))
  return tk('main.alert.duration.minutes', { count: minutes })
}
