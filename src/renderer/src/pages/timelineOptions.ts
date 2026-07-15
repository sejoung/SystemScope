import type { SystemEventCategory, TimelineRange } from '@shared/types'

export const RANGE_OPTIONS: { value: TimelineRange; labelKey: 'timeline.range.24h' | 'timeline.range.7d' | 'timeline.range.30d' }[] = [
  { value: '24h', labelKey: 'timeline.range.24h' },
  { value: '7d', labelKey: 'timeline.range.7d' },
  { value: '30d', labelKey: 'timeline.range.30d' },
]

export const EVENT_FILTER_OPTIONS: { value: SystemEventCategory | null; labelKey: string }[] = [
  { value: null, labelKey: 'timeline.events.filter.all' },
  { value: 'alert', labelKey: 'timeline.events.filter.alert' },
  { value: 'disk_cleanup', labelKey: 'timeline.events.filter.disk_cleanup' },
  { value: 'docker_cleanup', labelKey: 'timeline.events.filter.docker_cleanup' },
  { value: 'app_removal', labelKey: 'timeline.events.filter.app_removal' },
  { value: 'system', labelKey: 'timeline.events.filter.system' },
]
