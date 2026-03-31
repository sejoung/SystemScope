/** A single point-in-time system metrics snapshot */
export interface MetricPoint {
  /** Unix timestamp in ms */
  ts: number
  cpu: number           // 0-100 percentage
  memory: number        // 0-100 percentage
  memoryUsedBytes: number
  memoryTotalBytes: number
  diskUsagePercent: number
  diskReadBytesPerSec: number
  diskWriteBytesPerSec: number
  networkRxBytesPerSec: number
  networkTxBytesPerSec: number
  gpuUsage?: number     // 0-100, optional (not all systems have GPU)
  gpuMemoryUsage?: number
}

/** Range options for timeline queries */
export type TimelineRange = '24h' | '7d' | '30d'

/** A metric point with associated top process info */
export interface MetricPointDetail extends MetricPoint {
  topProcesses: {
    name: string
    pid: number
    cpu: number
    memory: number
  }[]
}

/** Timeline query result with downsampled points */
export interface TimelineData {
  range: TimelineRange
  points: MetricPoint[]
  alerts: TimelineAlert[]
}

/** Alert event marker on the timeline */
export interface TimelineAlert {
  ts: number
  type: string
  severity: 'warning' | 'critical'
  message: string
}
