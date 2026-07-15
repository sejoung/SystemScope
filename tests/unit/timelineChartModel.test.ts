import { describe, expect, it } from 'vitest'
import { buildAlertPoints, findClosestPointIndex } from '../../src/renderer/src/features/timeline/timelineChartModel'
import type { MetricPoint } from '../../src/shared/types'

function point(ts: number, cpu: number): MetricPoint {
  return {
    ts,
    cpu,
    memory: 0,
    memoryUsedBytes: 0,
    memoryTotalBytes: 0,
    diskUsagePercent: 0,
    diskReadBytesPerSec: 0,
    diskWriteBytesPerSec: 0,
    networkRxBytesPerSec: 0,
    networkTxBytesPerSec: 0,
  }
}

describe('timeline chart model', () => {
  it('finds the closest sorted point at boundaries and between samples', () => {
    const points = [{ ts: 10 }, { ts: 20 }, { ts: 40 }]
    expect(findClosestPointIndex(points, 1)).toBe(0)
    expect(findClosestPointIndex(points, 17)).toBe(1)
    expect(findClosestPointIndex(points, 35)).toBe(2)
    expect(findClosestPointIndex(points, 50)).toBe(2)
  })

  it('maps alerts to their nearest metric point', () => {
    const points = [point(10, 20), point(20, 80)]
    expect(buildAlertPoints(points, [{ ts: 18, type: 'cpu', severity: 'critical', message: 'hot' }])).toEqual([
      { ts: 20, cpu: 80, severity: 'critical', message: 'hot' },
    ])
  })
})
