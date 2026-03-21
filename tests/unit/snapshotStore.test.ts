import { describe, expect, it } from 'vitest'
import { areSnapshotsEquivalent, parseSnapshotData } from '../../src/main/services/snapshotStore'

describe('snapshotStore', () => {
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
})
