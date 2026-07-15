import type { MetricPoint } from '@shared/types'

export function createTimelineFixture(now: number): MetricPoint[] {
  return [
    { ts: now - 120_000, cpu: 20, memory: 35, diskUsagePercent: 40 },
    { ts: now - 60_000, cpu: 45, memory: 42, diskUsagePercent: 41 },
    { ts: now, cpu: 30, memory: 39, diskUsagePercent: 41 },
  ].map((point) => ({
    ...point,
    memoryUsedBytes: 6_000_000_000,
    memoryTotalBytes: 16_000_000_000,
    diskReadBytesPerSec: 1_000,
    diskWriteBytesPerSec: 2_000,
    networkRxBytesPerSec: 3_000,
    networkTxBytesPerSec: 4_000,
  }))
}
