import type { Alert, AlertThresholds, AlertType, AlertSeverity, SystemStats } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import { ALERT_COOLDOWN_MS, MAX_ACTIVE_ALERTS } from '@shared/constants/thresholds'

let thresholds: AlertThresholds = { ...DEFAULT_THRESHOLDS }
const activeAlerts: Map<string, Alert> = new Map()
const lastFired: Map<string, number> = new Map()
let alertCounter = 0

export function setThresholds(newThresholds: Partial<AlertThresholds>): void {
  thresholds = { ...thresholds, ...newThresholds }
}

export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values())
}

export function dismissAlert(id: string): boolean {
  return activeAlerts.delete(id)
}

export function checkAlerts(stats: SystemStats): Alert[] {
  const newAlerts: Alert[] = []

  // 디스크 알림 — macOS에서는 purgeable 제외한 realUsage 기준으로 판단
  for (const drive of stats.disk.drives) {
    const key = `disk:${drive.mount}`
    const effectiveUsage = drive.realUsage ?? drive.usage
    if (effectiveUsage >= thresholds.diskCritical) {
      const alert = createAlertIfCooldown(key, 'disk', 'critical', `디스크 ${drive.mount} 사용률 ${effectiveUsage}%`, effectiveUsage, thresholds.diskCritical)
      if (alert) newAlerts.push(alert)
    } else if (effectiveUsage >= thresholds.diskWarning) {
      const alert = createAlertIfCooldown(key, 'disk', 'warning', `디스크 ${drive.mount} 사용률 ${effectiveUsage}%`, effectiveUsage, thresholds.diskWarning)
      if (alert) newAlerts.push(alert)
    }
  }

  // 메모리 알림
  if (stats.memory.usage >= thresholds.memoryCritical) {
    const alert = createAlertIfCooldown('memory', 'memory', 'critical', `메모리 사용률 ${stats.memory.usage}%`, stats.memory.usage, thresholds.memoryCritical)
    if (alert) newAlerts.push(alert)
  } else if (stats.memory.usage >= thresholds.memoryWarning) {
    const alert = createAlertIfCooldown('memory', 'memory', 'warning', `메모리 사용률 ${stats.memory.usage}%`, stats.memory.usage, thresholds.memoryWarning)
    if (alert) newAlerts.push(alert)
  }

  // GPU 메모리 알림
  if (stats.gpu.available && stats.gpu.memoryTotal && stats.gpu.memoryUsed) {
    const gpuUsage = Math.round((stats.gpu.memoryUsed / stats.gpu.memoryTotal) * 10000) / 100
    if (gpuUsage >= thresholds.gpuMemoryCritical) {
      const alert = createAlertIfCooldown('gpu', 'gpu', 'critical', `GPU 메모리 사용률 ${gpuUsage}%`, gpuUsage, thresholds.gpuMemoryCritical)
      if (alert) newAlerts.push(alert)
    } else if (gpuUsage >= thresholds.gpuMemoryWarning) {
      const alert = createAlertIfCooldown('gpu', 'gpu', 'warning', `GPU 메모리 사용률 ${gpuUsage}%`, gpuUsage, thresholds.gpuMemoryWarning)
      if (alert) newAlerts.push(alert)
    }
  }

  return newAlerts
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
  const last = lastFired.get(key)
  if (last && now - last < ALERT_COOLDOWN_MS) return null

  lastFired.set(key, now)

  // 최대 알림 수 초과 시 가장 오래된 알림 제거
  if (activeAlerts.size >= MAX_ACTIVE_ALERTS) {
    const oldestKey = activeAlerts.keys().next().value
    if (oldestKey !== undefined) activeAlerts.delete(oldestKey)
  }

  const id = `alert-${++alertCounter}-${now}`
  const alert: Alert = { id, type, severity, message, value, threshold, timestamp: now, dismissed: false }
  activeAlerts.set(id, alert)
  return alert
}
