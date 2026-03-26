import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userDataPath: '',
  snapshotIntervalMin: 60
}))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected app path request: ${name}`)
      return state.userDataPath
    }
  }
}))

vi.mock('../../src/main/store/settingsStore', () => ({
  getSettings: () => ({
    thresholds: {
      diskWarning: 75,
      diskCritical: 90,
      memoryWarning: 75,
      memoryCritical: 90,
      gpuMemoryWarning: 80,
      gpuMemoryCritical: 95
    },
    theme: 'dark',
    locale: 'en',
    snapshotIntervalMin: state.snapshotIntervalMin
  })
}))

const snapshotStore = await import('../../src/main/services/snapshotStore')
const { areSnapshotsEquivalent, getMaxSnapshots, parseSnapshotData, saveSnapshot, loadSnapshots } = snapshotStore

describe('snapshotStore', () => {
  let tempRoot = ''

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'systemscope-snapshots-'))
    state.userDataPath = tempRoot
  })

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('should parse valid snapshot data', () => {
    const parsed = parseSnapshotData(JSON.stringify({
      version: 1,
      snapshots: [
        {
          timestamp: 1,
          folders: [],
          totalSize: 0
        }
      ]
    }))

    expect(parsed).not.toBeNull()
    expect(parsed?.snapshots).toHaveLength(1)
  })

  it('should reject malformed snapshot payloads', () => {
    expect(parseSnapshotData('{"version":1,"snapshots":[]} trailing')).toBeNull()
    expect(parseSnapshotData(JSON.stringify({ version: 2, snapshots: [] }))).toBeNull()
    expect(parseSnapshotData(JSON.stringify({ version: 1, snapshots: {} }))).toBeNull()
  })

  it('should treat snapshots with identical folder contents as duplicates', () => {
    const a = {
      timestamp: 1,
      totalSize: 300,
      folders: [
        { name: 'Documents', path: '/Users/test/Documents', size: 100 },
        { name: 'Downloads', path: '/Users/test/Downloads', size: 200 }
      ]
    }
    const b = {
      timestamp: 2,
      totalSize: 300,
      folders: [
        { name: 'Documents', path: '/Users/test/Documents', size: 100 },
        { name: 'Downloads', path: '/Users/test/Downloads', size: 200 }
      ]
    }

    expect(areSnapshotsEquivalent(a, b)).toBe(true)
  })

  it('should distinguish snapshots when folder contents change', () => {
    const a = {
      timestamp: 1,
      totalSize: 300,
      folders: [
        { name: 'Documents', path: '/Users/test/Documents', size: 100 },
        { name: 'Downloads', path: '/Users/test/Downloads', size: 200 }
      ]
    }
    const b = {
      timestamp: 2,
      totalSize: 350,
      folders: [
        { name: 'Documents', path: '/Users/test/Documents', size: 150 },
        { name: 'Downloads', path: '/Users/test/Downloads', size: 200 }
      ]
    }

    expect(areSnapshotsEquivalent(a, b)).toBe(false)
  })

  it('should serialize concurrent saves without losing snapshots', async () => {
    const first = {
      timestamp: 1,
      totalSize: 100,
      folders: [{ name: 'Documents', path: '/Users/test/Documents', size: 100 }]
    }
    const second = {
      timestamp: 2,
      totalSize: 200,
      folders: [{ name: 'Documents', path: '/Users/test/Documents', size: 200 }]
    }

    await Promise.all([saveSnapshot(first), saveSnapshot(second)])

    const snapshots = await loadSnapshots()
    expect(snapshots).toHaveLength(2)
    expect(snapshots.map((snapshot: { timestamp: number }) => snapshot.timestamp)).toEqual([1, 2])
  })

  it('should retain enough snapshots to cover seven days for shorter intervals', () => {
    state.snapshotIntervalMin = 15

    expect(getMaxSnapshots()).toBe(673)
  })

  it('should back up invalid snapshot files before starting fresh', async () => {
    const snapshotDir = path.join(tempRoot, 'snapshots')
    await fs.mkdir(snapshotDir, { recursive: true })
    await fs.writeFile(path.join(snapshotDir, 'growth.json'), '{"version":1,"snapshots":[]} trailing', 'utf-8')

    const snapshots = await loadSnapshots()
    const files = await fs.readdir(snapshotDir)

    expect(snapshots).toEqual([])
    expect(files.some((file) => file.startsWith('growth.json.corrupt-'))).toBe(true)
    expect(files.includes('growth.json')).toBe(false)
  })
})
