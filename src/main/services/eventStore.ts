import { randomUUID } from 'node:crypto'
import { PersistentStore } from './persistentStore'
import { getEventsFilePath } from './dataDir'
import { getSettings } from '../store/settingsStore'
import { logError, logInfo } from './logging'
import type { SystemEvent, SystemEventCategory, SystemEventSeverity, EventQueryOptions } from '@shared/types'

const SCHEMA_VERSION = 1
const MAX_EVENTS = 5000
const MS_PER_DAY = 24 * 60 * 60 * 1000

let store: PersistentStore<SystemEvent> | null = null

export async function initEventStore(): Promise<void> {
  const settings = getSettings()
  const retentionDays = settings.history.eventsRetentionDays

  store = new PersistentStore<SystemEvent>({
    filePath: getEventsFilePath(),
    schemaVersion: SCHEMA_VERSION,
    maxEntries: MAX_EVENTS,
    maxAgeMs: retentionDays * MS_PER_DAY,
    getTimestamp: (entry) => entry.ts
  })

  await store.load()
  logInfo('event-store', 'Event store initialized', { retentionDays })
}

export function stopEventStore(): void {
  store = null
  logInfo('event-store', 'Event store stopped')
}

export async function recordEvent(
  category: SystemEventCategory,
  severity: SystemEventSeverity,
  title: string,
  detail?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!store) {
    logError('event-store', 'Cannot record event: store not initialized', { category, title })
    return
  }

  const event: SystemEvent = {
    id: randomUUID(),
    ts: Date.now(),
    category,
    severity,
    title,
    ...(detail !== undefined && detail !== null && { detail }),
    ...(metadata !== undefined && metadata !== null && { metadata })
  }

  await store.append(event)
}

export async function getEventHistory(options?: EventQueryOptions): Promise<SystemEvent[]> {
  if (!store) return []

  let events = await store.load()

  if (options?.category) {
    const category = options.category
    events = events.filter((e) => e.category === category)
  }
  if (options?.since !== undefined && options.since !== null) {
    const since = options.since
    events = events.filter((e) => e.ts >= since)
  }
  if (options?.until !== undefined && options.until !== null) {
    const until = options.until
    events = events.filter((e) => e.ts <= until)
  }

  // Sort by timestamp descending (newest first)
  events = [...events].sort((a, b) => b.ts - a.ts)

  if (options?.limit !== undefined && options.limit !== null && options.limit > 0) {
    events = events.slice(0, options.limit)
  }

  return events
}

export async function getRecentEvents(count: number = 20): Promise<SystemEvent[]> {
  return getEventHistory({ limit: count })
}
