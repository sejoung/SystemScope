import { describe, it, expect, vi } from 'vitest'
import type { SessionSnapshot } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getPath: () => '/tmp/test' },
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => ({
    thresholds: {
      cpuWarning: 80, cpuCritical: 90,
      diskWarning: 75, diskCritical: 90,
      memoryWarning: 75, memoryCritical: 90,
      gpuMemoryWarning: 80, gpuMemoryCritical: 95
    },
    theme: 'dark', locale: 'en', snapshotIntervalMin: 60
  })
}))

const { computeSnapshotDiff } = await import('../../src/main/services/sessionSnapshotStore')

const makeSnapshot = (overrides: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  id: 'snap-1',
  label: 'Test',
  timestamp: 1000,
  system: {
    cpuUsage: 50,
    memoryUsage: 60,
    memoryTotal: 16_000_000_000,
    diskUsage: 70,
    diskTotal: 500_000_000_000,
    gpuUsage: null,
    networkRxSec: 1000,
    networkTxSec: 500,
  },
  topProcesses: [
    { name: 'chrome', pid: 100, cpu: 30, memory: 20 },
    { name: 'node', pid: 200, cpu: 10, memory: 15 },
  ],
  activeAlerts: [{ type: 'cpu', severity: 'warning', message: 'CPU high' }],
  docker: { imagesCount: 5, containersCount: 2, volumesCount: 3, totalSize: 1_000_000_000 },
  ...overrides,
})

describe('sessionSnapshotStore', () => {
  describe('computeSnapshotDiff', () => {
    it('computes system metric deltas', () => {
      const snap1 = makeSnapshot({ id: 's1', system: { ...makeSnapshot().system, cpuUsage: 40 } })
      const snap2 = makeSnapshot({ id: 's2', system: { ...makeSnapshot().system, cpuUsage: 80 } })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.system.cpuUsage.before).toBe(40)
      expect(diff.system.cpuUsage.after).toBe(80)
      expect(diff.system.cpuUsage.delta).toBe(40)
    })

    it('detects added and removed processes', () => {
      const snap1 = makeSnapshot({
        id: 's1',
        topProcesses: [{ name: 'chrome', pid: 100, cpu: 30, memory: 20 }],
      })
      const snap2 = makeSnapshot({
        id: 's2',
        topProcesses: [{ name: 'firefox', pid: 300, cpu: 25, memory: 18 }],
      })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.processChanges.added).toContain('firefox')
      expect(diff.processChanges.removed).toContain('chrome')
    })

    it('detects alert changes', () => {
      const snap1 = makeSnapshot({
        id: 's1',
        activeAlerts: [{ type: 'cpu', severity: 'warning', message: 'CPU high' }],
      })
      const snap2 = makeSnapshot({
        id: 's2',
        activeAlerts: [{ type: 'memory', severity: 'critical', message: 'Memory full' }],
      })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.alertChanges.added).toContain('memory')
      expect(diff.alertChanges.removed).toContain('cpu')
    })

    it('handles null docker in either snapshot', () => {
      const snap1 = makeSnapshot({ id: 's1', docker: null })
      const snap2 = makeSnapshot({ id: 's2' })

      const diff = computeSnapshotDiff(snap1, snap2)

      expect(diff.dockerDelta).toBeNull()
    })
  })
})
