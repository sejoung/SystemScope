import { describe, expect, it } from 'vitest'
import { getCpuSignal, getGpuSignal, getMemorySignal } from '../../src/main/services/alerts/alertSignals'
import type { AlertThresholds, SystemStats } from '../../src/shared/types'

const thresholds: AlertThresholds = {
  cpuWarning: 75,
  cpuCritical: 90,
  memoryWarning: 75,
  memoryCritical: 90,
  diskWarning: 75,
  diskCritical: 90,
  gpuMemoryWarning: 80,
  gpuMemoryCritical: 95,
}

function stats(memoryUsage = 50, available = 8, total = 16, swapUsed = 0): SystemStats {
  return {
    cpu: { usage: 50, cores: [], model: '', speed: 0 },
    memory: { usage: memoryUsage, available, total, used: total - available, active: 0, cached: 0, swapTotal: 4, swapUsed },
    gpu: { available: false, model: null, usage: null, memoryTotal: null, memoryUsed: null, temperature: null, unavailableReason: null },
    disk: { io: { readsPerSecond: null, writesPerSecond: null, totalPerSecond: null, busyPercent: null }, drives: [] },
    network: { downloadBytesPerSecond: null, uploadBytesPerSecond: null, totalDownloadedBytes: null, totalUploadedBytes: null, interfaces: [] },
    timestamp: 0,
  }
}

describe('alert signals', () => {
  it('uses rounded values and critical precedence at threshold boundaries', () => {
    const input = stats()
    input.cpu.usage = 89.96
    expect(getCpuSignal(input, thresholds)).toMatchObject({ severity: 'critical', value: 90, threshold: 90, sustainedMs: 30_000 })
    expect(getGpuSignal(79.94, thresholds)).toBeNull()
    expect(getGpuSignal(79.96, thresholds)).toMatchObject({ severity: 'warning', value: 80 })
  })

  it('requires pressure evidence for a memory warning', () => {
    expect(getMemorySignal(stats(80, 8, 16), thresholds)).toBeNull()
    expect(getMemorySignal(stats(80, 2, 16), thresholds)).toMatchObject({ severity: 'warning' })
    expect(getMemorySignal(stats(80, 8, 16, 1), thresholds)).toMatchObject({ severity: 'warning' })
  })

  it('treats low available memory with active swap as critical and handles zero total safely', () => {
    expect(getMemorySignal(stats(50, 0.5, 16, 1), thresholds)).toMatchObject({ severity: 'critical' })
    expect(getMemorySignal(stats(80, 0, 0), thresholds)).toBeNull()
  })
})
