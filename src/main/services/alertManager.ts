import { randomUUID } from 'node:crypto'
import type { Alert, AlertThresholds, AlertType, AlertSeverity, SystemStats } from '@shared/types'
import { DEFAULT_THRESHOLDS } from '@shared/types'
import { ALERT_COOLDOWN_MS, MAX_ACTIVE_ALERTS } from '@shared/constants/thresholds'
import { tk } from '../i18n'
import { onAlertFired, onAlertResolved } from './alertHistory'

let thresholds: AlertThresholds = { ...DEFAULT_THRESHOLDS }
const activeAlerts: Map<string, Alert> = new Map()
const lastFired: Map<string, number> = new Map()
const activeAlertTypes = new Set<string>()

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
  // Evict expired entries from lastFired to prevent unbounded growth
  const now = Date.now()
  for (const [key, timestamp] of lastFired) {
    if (now - timestamp > ALERT_COOLDOWN_MS) {
      lastFired.delete(key)
    }
  }

  const newAlerts: Alert[] = []
  const checkedKeys = new Set<string>()

  // CPU 알림
  if (stats.cpu.usage >= thresholds.cpuCritical) {
    checkedKeys.add('cpu')
    const alert = createAlertIfCooldown(
      'cpu',
      'cpu',
      'critical',
      tk('main.alert.message.cpu_usage', { usage: stats.cpu.usage }),
      stats.cpu.usage,
      thresholds.cpuCritical
    )
    if (alert) newAlerts.push(alert)
  } else if (stats.cpu.usage >= thresholds.cpuWarning) {
    checkedKeys.add('cpu')
    const alert = createAlertIfCooldown(
      'cpu',
      'cpu',
      'warning',
      tk('main.alert.message.cpu_usage', { usage: stats.cpu.usage }),
      stats.cpu.usage,
      thresholds.cpuWarning
    )
    if (alert) newAlerts.push(alert)
  } else if (activeAlertTypes.has('cpu')) {
    activeAlertTypes.delete('cpu')
    onAlertResolved('cpu')
  }

  // 디스크 알림 — macOS에서는 purgeable 제외한 realUsage 기준으로 판단
  for (const drive of stats.disk.drives) {
    const key = `disk:${drive.mount}`
    const effectiveUsage = drive.realUsage ?? drive.usage
    if (effectiveUsage >= thresholds.diskCritical) {
      checkedKeys.add(key)
      const alert = createAlertIfCooldown(
        key,
        'disk',
        'critical',
        tk('main.alert.message.disk_usage', { mount: drive.mount, usage: effectiveUsage }),
        effectiveUsage,
        thresholds.diskCritical
      )
      if (alert) newAlerts.push(alert)
    } else if (effectiveUsage >= thresholds.diskWarning) {
      checkedKeys.add(key)
      const alert = createAlertIfCooldown(
        key,
        'disk',
        'warning',
        tk('main.alert.message.disk_usage', { mount: drive.mount, usage: effectiveUsage }),
        effectiveUsage,
        thresholds.diskWarning
      )
      if (alert) newAlerts.push(alert)
    } else if (activeAlertTypes.has(key)) {
      activeAlertTypes.delete(key)
      onAlertResolved(key)
    }
  }

  // 메모리 알림
  if (stats.memory.usage >= thresholds.memoryCritical) {
    checkedKeys.add('memory')
    const alert = createAlertIfCooldown(
      'memory',
      'memory',
      'critical',
      tk('main.alert.message.memory_usage', { usage: stats.memory.usage }),
      stats.memory.usage,
      thresholds.memoryCritical
    )
    if (alert) newAlerts.push(alert)
  } else if (stats.memory.usage >= thresholds.memoryWarning) {
    checkedKeys.add('memory')
    const alert = createAlertIfCooldown(
      'memory',
      'memory',
      'warning',
      tk('main.alert.message.memory_usage', { usage: stats.memory.usage }),
      stats.memory.usage,
      thresholds.memoryWarning
    )
    if (alert) newAlerts.push(alert)
  } else if (activeAlertTypes.has('memory')) {
    activeAlertTypes.delete('memory')
    onAlertResolved('memory')
  }

  // GPU 메모리 알림
  if (stats.gpu.available && stats.gpu.memoryTotal && stats.gpu.memoryUsed) {
    const gpuUsage = Math.round((stats.gpu.memoryUsed / stats.gpu.memoryTotal) * 10000) / 100
    if (gpuUsage >= thresholds.gpuMemoryCritical) {
      checkedKeys.add('gpu')
      const alert = createAlertIfCooldown(
        'gpu',
        'gpu',
        'critical',
        tk('main.alert.message.gpu_memory_usage', { usage: gpuUsage }),
        gpuUsage,
        thresholds.gpuMemoryCritical
      )
      if (alert) newAlerts.push(alert)
    } else if (gpuUsage >= thresholds.gpuMemoryWarning) {
      checkedKeys.add('gpu')
      const alert = createAlertIfCooldown(
        'gpu',
        'gpu',
        'warning',
        tk('main.alert.message.gpu_memory_usage', { usage: gpuUsage }),
        gpuUsage,
        thresholds.gpuMemoryWarning
      )
      if (alert) newAlerts.push(alert)
    } else if (activeAlertTypes.has('gpu')) {
      activeAlertTypes.delete('gpu')
      onAlertResolved('gpu')
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

  const id = `alert-${randomUUID()}`
  const alert: Alert = { id, type, severity, message, value, threshold, timestamp: now, dismissed: false }
  activeAlerts.set(id, alert)

  if (!activeAlertTypes.has(key)) {
    activeAlertTypes.add(key)
    onAlertFired(key, severity, message)
  }

  return alert
}
