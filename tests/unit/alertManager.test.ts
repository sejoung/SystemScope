import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemStats } from '../../src/shared/types'

function makeStats(overrides: Partial<{
  cpuUsage: number
  memoryUsage: number
  memorySwapUsed: number
  diskUsage: number
  diskSize: number
  gpuMemUsed: number
  gpuMemTotal: number
}>): SystemStats {
  const {
    cpuUsage = 50,
    memoryUsage = 50,
    memorySwapUsed = 0,
    diskUsage = 50,
    diskSize = 500_000_000_000,
    gpuMemUsed = 0,
    gpuMemTotal = 0
  } = overrides
  return {
    cpu: { usage: cpuUsage, cores: [cpuUsage], temperature: null, model: 'Test CPU', speed: 3.0 },
    memory: {
      total: 16_000_000_000,
      used: (memoryUsage / 100) * 16_000_000_000,
      active: (memoryUsage / 100) * 16_000_000_000,
      available: ((100 - memoryUsage) / 100) * 16_000_000_000,
      cached: 0,
      usage: memoryUsage,
      swapTotal: 4_000_000_000,
      swapUsed: memorySwapUsed
    },
    gpu: {
      available: gpuMemTotal > 0,
      model: 'Test GPU',
      usage: null,
      memoryTotal: gpuMemTotal || null,
      memoryUsed: gpuMemUsed || null,
      temperature: null,
      unavailableReason: null
    },
    disk: {
      io: {
        readsPerSecond: null,
        writesPerSecond: null,
        totalPerSecond: null,
        busyPercent: null
      },
      drives: [{
        fs: '/dev/sda1',
        type: 'ext4',
        size: diskSize,
        used: (diskUsage / 100) * diskSize,
        available: ((100 - diskUsage) / 100) * diskSize,
        usage: diskUsage,
        mount: '/',
        purgeable: null,
        realUsage: null
      }]
    },
    network: {
      downloadBytesPerSecond: null,
      uploadBytesPerSecond: null,
      totalDownloadedBytes: null,
      totalUploadedBytes: null,
      interfaces: []
    },
    timestamp: Date.now()
  }
}

describe('AlertManager', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not fire alerts when values are below thresholds', async () => {
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    const alerts = checkAlerts(makeStats({ memoryUsage: 50, diskUsage: 50 }))
    expect(alerts).toHaveLength(0)
  })

  it('should ignore brief CPU spikes', async () => {
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    const alerts = checkAlerts(makeStats({ cpuUsage: 85 }))
    expect(alerts).toHaveLength(0)
  })

  it('should fire CPU warning only after sustained high usage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')

    expect(checkAlerts(makeStats({ cpuUsage: 85 }))).toHaveLength(0)
    vi.setSystemTime(60_000)
    const alerts = checkAlerts(makeStats({ cpuUsage: 86 }))

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ type: 'cpu', severity: 'warning' })
    expect(alerts[0].message).toContain('CPU has stayed high')
  })

  it('should fire warning alert when disk usage and free space are both concerning', async () => {
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    const alerts = checkAlerts(makeStats({ diskUsage: 85, diskSize: 300_000_000_000 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].type).toBe('disk')
    expect(alerts[0].severity).toBe('warning')
    expect(alerts[0].message).toContain('running low')
  })

  it('should fire critical alert when disk usage exceeds critical threshold', async () => {
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    const alerts = checkAlerts(makeStats({ diskUsage: 95 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].severity).toBe('critical')
  })

  it('should fire memory warning after sustained pressure', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')

    expect(checkAlerts(makeStats({ memoryUsage: 85 }))).toHaveLength(0)
    vi.setSystemTime(60_000)
    const alerts = checkAlerts(makeStats({ memoryUsage: 86 }))
    const memAlert = alerts.find((a) => a.type === 'memory')
    expect(memAlert).toBeDefined()
    expect(memAlert!.severity).toBe('warning')
    expect(memAlert!.message).toContain('Memory pressure has persisted')
  })

  it('should fire memory critical after sustained severe pressure', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')

    expect(checkAlerts(makeStats({ memoryUsage: 95, memorySwapUsed: 500_000_000 }))).toHaveLength(0)
    vi.setSystemTime(30_000)
    const alerts = checkAlerts(makeStats({ memoryUsage: 96, memorySwapUsed: 700_000_000 }))
    const memAlert = alerts.find((a) => a.type === 'memory')
    expect(memAlert).toBeDefined()
    expect(memAlert!.severity).toBe('critical')
  })

  it('should respect cooldown and not fire duplicate alerts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    checkAlerts(makeStats({ memoryUsage: 95 }))
    vi.setSystemTime(30_000)
    const alerts1 = checkAlerts(makeStats({ memoryUsage: 95 }))
    expect(alerts1.length).toBeGreaterThan(0)

    vi.setSystemTime(31_000)
    const alerts2 = checkAlerts(makeStats({ memoryUsage: 95 }))
    const memAlerts2 = alerts2.filter((a) => a.type === 'memory')
    expect(memAlerts2).toHaveLength(0)
  })

  it('should allow dismissing alerts', async () => {
    const { checkAlerts, getActiveAlerts, dismissAlert } = await import('../../src/main/services/alerts/alertManager')
    const alerts = checkAlerts(makeStats({ diskUsage: 95 }))
    expect(alerts.length).toBeGreaterThan(0)

    const active = getActiveAlerts()
    expect(active.length).toBeGreaterThan(0)

    const dismissed = dismissAlert(active[0].id)
    expect(dismissed).toBe(true)

    const afterDismiss = getActiveAlerts()
    expect(afterDismiss.find((a) => a.id === active[0].id)).toBeUndefined()
  })

  it('should handle custom thresholds', async () => {
    const { setThresholds, checkAlerts } = await import('../../src/main/services/alerts/alertManager')
    setThresholds({ diskWarning: 50, diskCritical: 60 })
    const alerts = checkAlerts(makeStats({ diskUsage: 55, diskSize: 100_000_000_000 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].severity).toBe('warning')
  })

  it('should remove active alerts after sustained recovery', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { checkAlerts, getActiveAlerts } = await import('../../src/main/services/alerts/alertManager')

    checkAlerts(makeStats({ cpuUsage: 85 }))
    vi.setSystemTime(60_000)
    checkAlerts(makeStats({ cpuUsage: 86 }))
    expect(getActiveAlerts().some((alert) => alert.type === 'cpu')).toBe(true)

    vi.setSystemTime(61_000)
    checkAlerts(makeStats({ cpuUsage: 50 }))
    expect(getActiveAlerts().some((alert) => alert.type === 'cpu')).toBe(true)

    vi.setSystemTime(121_000)
    checkAlerts(makeStats({ cpuUsage: 50 }))
    expect(getActiveAlerts().some((alert) => alert.type === 'cpu')).toBe(false)
  })
})
