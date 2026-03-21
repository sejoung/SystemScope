import { describe, expect, it } from 'vitest'
import { parseSnapshotData } from '../../src/main/services/snapshotStore'

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
})
