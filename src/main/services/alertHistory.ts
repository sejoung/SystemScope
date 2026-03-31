import { randomUUID } from 'node:crypto'
import { PersistentStore } from './persistentStore'
import { getAlertHistoryFilePath } from './dataDir'
import { logError, logInfo } from './logging'
import type { AlertHistoryEntry, AlertPattern, AlertIntelligence } from '@shared/types'

const SCHEMA_VERSION = 1
const MAX_ENTRIES = 2000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const RETENTION_DAYS = 30
const SUSTAINED_THRESHOLD_MS = 300_000 // 5 minutes
const PATTERN_PERIOD_MS = 24 * 60 * 60 * 1000 // 24h
const PATTERN_MIN_COUNT = 2
const DEFAULT_HISTORY_LIMIT = 50

let store: PersistentStore<AlertHistoryEntry> | null = null
const activeAlertMap = new Map<string, AlertHistoryEntry>() // key: alert type

export async function initAlertHistory(): Promise<void> {
  store = new PersistentStore<AlertHistoryEntry>({
    filePath: getAlertHistoryFilePath(),
    schemaVersion: SCHEMA_VERSION,
    maxEntries: MAX_ENTRIES,
    maxAgeMs: RETENTION_DAYS * MS_PER_DAY,
    getTimestamp: (entry) => entry.firedAt
  })

  await store.load()
  logInfo('alert-history', 'Alert history initialized', { retentionDays: RETENTION_DAYS })
}

export function stopAlertHistory(): void {
  store = null
  activeAlertMap.clear()
  logInfo('alert-history', 'Alert history stopped')
}

export function onAlertFired(type: string, severity: 'warning' | 'critical', message: string): void {
  const entry: AlertHistoryEntry = {
    id: randomUUID(),
    type,
    severity,
    message,
    firedAt: Date.now()
  }

  activeAlertMap.set(type, entry)

  if (store) {
    void store.append(entry).catch((err) => {
      logError('alert-history', 'Failed to append alert history entry', { type, error: err })
    })
  }
}

export function onAlertResolved(type: string): void {
  const entry = activeAlertMap.get(type)
  if (!entry) return

  const now = Date.now()
  entry.resolvedAt = now
  entry.durationMs = now - entry.firedAt
  activeAlertMap.delete(type)

  if (store) {
    void store.append({ ...entry }).catch((err) => {
      logError('alert-history', 'Failed to append resolved alert history entry', { type, error: err })
    })
  }
}

export async function getAlertIntelligence(): Promise<AlertIntelligence> {
  const now = Date.now()

  // Active alerts from activeAlertMap
  const activeAlerts = Array.from(activeAlertMap.values())

  // Sustained alerts: active alerts where duration > 5 minutes
  const sustainedAlerts = activeAlerts.filter((entry) => {
    const duration = entry.durationMs ?? (now - entry.firedAt)
    return duration > SUSTAINED_THRESHOLD_MS
  })

  // Patterns: group entries by type within last 24h
  const patterns: AlertPattern[] = []
  if (store) {
    const allEntries = await store.load()
    const cutoff = now - PATTERN_PERIOD_MS
    const recentEntries = allEntries.filter((e) => e.firedAt >= cutoff)

    const grouped = new Map<string, AlertHistoryEntry[]>()
    for (const entry of recentEntries) {
      const existing = grouped.get(entry.type)
      if (existing) {
        existing.push(entry)
      } else {
        grouped.set(entry.type, [entry])
      }
    }

    for (const [type, entries] of grouped) {
      if (entries.length >= PATTERN_MIN_COUNT) {
        let lastOccurred = 0
        for (const e of entries) {
          if (e.firedAt > lastOccurred) lastOccurred = e.firedAt
        }
        patterns.push({
          type,
          count: entries.length,
          period: '24h',
          lastOccurred
        })
      }
    }
  }

  return { activeAlerts, patterns, sustainedAlerts }
}

export async function getAlertHistory(limit?: number): Promise<AlertHistoryEntry[]> {
  if (!store) return []

  const entries = await store.load()
  const sorted = [...entries].sort((a, b) => b.firedAt - a.firedAt)
  const effectiveLimit = limit ?? DEFAULT_HISTORY_LIMIT

  return sorted.slice(0, effectiveLimit)
}
