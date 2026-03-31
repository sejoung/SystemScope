export type SystemEventCategory =
  | 'alert'
  | 'disk_cleanup'
  | 'docker_cleanup'
  | 'app_removal'
  | 'settings_change'
  | 'system'

export type SystemEventSeverity = 'info' | 'warning' | 'error'

export interface SystemEvent {
  id: string
  ts: number              // Unix timestamp in ms
  category: SystemEventCategory
  severity: SystemEventSeverity
  title: string
  detail?: string
  metadata?: Record<string, unknown>
}

export interface EventQueryOptions {
  category?: SystemEventCategory
  since?: number          // Unix timestamp
  until?: number
  limit?: number
}
