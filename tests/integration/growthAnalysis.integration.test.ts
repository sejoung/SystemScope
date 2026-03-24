import { beforeEach, describe, expect, it, vi } from 'vitest'

const snapshotState = vi.hoisted(() => ({
  snapshots: [] as Array<{
    timestamp: number
    folders: Array<{ name: string; path: string; size: number }>
    totalSize: number
  }>
}))

const execFileMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return {
    ...actual,
    homedir: () => '/Users/test',
    platform: () => 'darwin'
  }
})

vi.mock('fs/promises', () => ({
  access: accessMock
}))

vi.mock('child_process', () => ({
  execFile: execFileMock
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../../src/main/services/logging', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn()
}))

vi.mock('../../src/main/services/snapshotStore', () => ({
  saveSnapshot: async (snapshot: { timestamp: number; folders: Array<{ name: string; path: string; size: number }>; totalSize: number }) => {
    snapshotState.snapshots.push(snapshot)
  },
  getSnapshotsInRange: (since: number) => snapshotState.snapshots.filter((snapshot) => snapshot.timestamp >= since),
  loadSnapshots: () => snapshotState.snapshots
}))

describe('growth analysis integration', () => {
  beforeEach(() => {
    vi.resetModules()
    snapshotState.snapshots = []
    accessMock.mockReset()
    execFileMock.mockReset()
    accessMock.mockResolvedValue(undefined)
    execFileMock.mockImplementation((_cmd, args, _options, callback) => {
      const pathArg = (args as string[])[1] ?? '/Users/test/unknown'
      callback(null, `256\t${pathArg}\n`, '')
    })
  })

  it('should create a fresh snapshot and compute growth against older history', async () => {
    const now = Date.now()
    snapshotState.snapshots = [
      {
        timestamp: now - 6 * 60 * 60 * 1000,
        folders: [
          { name: 'Documents', path: '/Users/test/Documents', size: 100 * 1024 },
          { name: 'Downloads', path: '/Users/test/Downloads', size: 200 * 1024 }
        ],
        totalSize: 300 * 1024
      }
    ]

    const { analyzeGrowth } = await import('../../src/main/services/growthAnalyzer')
    const result = await analyzeGrowth('24h')

    expect(snapshotState.snapshots).toHaveLength(2)
    expect(result.period).toBe('24h')
    expect(result.folders.length).toBeGreaterThan(0)
    expect(result.cutoffMs).toBeLessThanOrEqual(Date.now())
  })

  it('should reuse a recent snapshot instead of writing a duplicate immediately', async () => {
    const now = Date.now()
    snapshotState.snapshots = [
      {
        timestamp: now - 60 * 1000,
        folders: [
          { name: 'Documents', path: '/Users/test/Documents', size: 120 * 1024 },
          { name: 'Downloads', path: '/Users/test/Downloads', size: 300 * 1024 }
        ],
        totalSize: 420 * 1024
      }
    ]

    const { analyzeGrowth } = await import('../../src/main/services/growthAnalyzer')
    const result = await analyzeGrowth('24h')

    expect(snapshotState.snapshots).toHaveLength(1)
    expect(result.totalAdded).toBe(0)
  })

  it('should use the last snapshot before the cutoff as the growth baseline', async () => {
    const now = Date.now()
    snapshotState.snapshots = [
      {
        timestamp: now - 30 * 60 * 60 * 1000,
        folders: [
          { name: 'Documents', path: '/Users/test/Documents', size: 100 * 1024 }
        ],
        totalSize: 100 * 1024
      },
      {
        timestamp: now - 20 * 60 * 60 * 1000,
        folders: [
          { name: 'Documents', path: '/Users/test/Documents', size: 220 * 1024 }
        ],
        totalSize: 220 * 1024
      },
      {
        timestamp: now - 2 * 60 * 1000,
        folders: [
          { name: 'Documents', path: '/Users/test/Documents', size: 280 * 1024 }
        ],
        totalSize: 280 * 1024
      }
    ]

    const { analyzeGrowth } = await import('../../src/main/services/growthAnalyzer')
    const result = await analyzeGrowth('24h')

    expect(result.totalAdded).toBe(180 * 1024)
  })
})
