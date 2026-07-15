import type { MetricPoint, TimelineAlert } from '@shared/types'

export interface TimelineChartPoint {
  ts: number
  cpu: number
  memory: number
  disk: number
}

export interface TimelineAlertPoint {
  ts: number
  cpu: number
  severity: TimelineAlert['severity']
  message: string
}

/** Finds the closest point in a timestamp-sorted timeline in O(log n). */
export function findClosestPointIndex(points: ArrayLike<{ ts: number }>, timestamp: number): number {
  if (points.length === 0) return -1
  let low = 0
  let high = points.length - 1

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].ts < timestamp) low = middle + 1
    else high = middle
  }

  if (low === 0) return 0
  return timestamp - points[low - 1].ts <= points[low].ts - timestamp ? low - 1 : low
}

export function buildAlertPoints(points: MetricPoint[], alerts: TimelineAlert[]): TimelineAlertPoint[] {
  if (points.length === 0) return []
  return alerts.map((alert) => {
    const closest = points[findClosestPointIndex(points, alert.ts)]
    return {
      ts: closest.ts,
      cpu: closest.cpu,
      severity: alert.severity,
      message: alert.message,
    }
  })
}
