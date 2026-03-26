import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemStats } from '../../src/shared/types'

function makeStats(overrides: Partial<{
  memoryUsage: number
  diskUsage: number
  gpuMemUsed: number
  gpuMemTotal: number
}>): SystemStats {
  const { memoryUsage = 50, diskUsage = 50, gpuMemUsed = 0, gpuMemTotal = 0 } = overrides
  return {
    cpu: { usage: 50, cores: [50], temperature: null, model: 'Test CPU', speed: 3.0 },
    memory: {
      total: 16_000_000_000,
      used: (memoryUsage / 100) * 16_000_000_000,
      active: (memoryUsage / 100) * 16_000_000_000,
      available: ((100 - memoryUsage) / 100) * 16_000_000_000,
      cached: 0,
      usage: memoryUsage,
      swapTotal: 0,
      swapUsed: 0
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
        size: 500_000_000_000,
        used: (diskUsage / 100) * 500_000_000_000,
        available: ((100 - diskUsage) / 100) * 500_000_000_000,
        usage: diskUsage,
        mount: '/',
        purgeable: null,
        realUsage: null
      }]
    },
    timestamp: Date.now()
  }
}

describe('AlertManager', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should not fire alerts when values are below thresholds', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts = checkAlerts(makeStats({ memoryUsage: 50, diskUsage: 50 }))
    expect(alerts).toHaveLength(0)
  })

  it('should fire warning alert when disk usage exceeds warning threshold', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts = checkAlerts(makeStats({ diskUsage: 85 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].type).toBe('disk')
    expect(alerts[0].severity).toBe('warning')
    expect(alerts[0].message).toContain('Disk / usage 85%')
  })

  it('should fire critical alert when disk usage exceeds critical threshold', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts = checkAlerts(makeStats({ diskUsage: 95 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].severity).toBe('critical')
  })

  it('should fire memory warning alert', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts = checkAlerts(makeStats({ memoryUsage: 85 }))
    const memAlert = alerts.find((a) => a.type === 'memory')
    expect(memAlert).toBeDefined()
    expect(memAlert!.severity).toBe('warning')
  })

  it('should fire memory critical alert', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts = checkAlerts(makeStats({ memoryUsage: 95 }))
    const memAlert = alerts.find((a) => a.type === 'memory')
    expect(memAlert).toBeDefined()
    expect(memAlert!.severity).toBe('critical')
  })

  it('should respect cooldown and not fire duplicate alerts', async () => {
    const { checkAlerts } = await import('../../src/main/services/alertManager')
    const alerts1 = checkAlerts(makeStats({ memoryUsage: 95 }))
    expect(alerts1.length).toBeGreaterThan(0)

    const alerts2 = checkAlerts(makeStats({ memoryUsage: 95 }))
    const memAlerts2 = alerts2.filter((a) => a.type === 'memory')
    expect(memAlerts2).toHaveLength(0)
  })

  it('should allow dismissing alerts', async () => {
    const { checkAlerts, getActiveAlerts, dismissAlert } = await import('../../src/main/services/alertManager')
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
    const { setThresholds, checkAlerts } = await import('../../src/main/services/alertManager')
    setThresholds({ diskWarning: 50, diskCritical: 60 })
    const alerts = checkAlerts(makeStats({ diskUsage: 55 }))
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].severity).toBe('warning')
  })
})
