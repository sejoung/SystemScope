import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/contracts/channels'

describe('IPC_CHANNELS', () => {
  it('should have namespace format for all channels', () => {
    for (const [, value] of Object.entries(IPC_CHANNELS)) {
      expect(value).toMatch(/^[a-z]+:[a-zA-Z]+$/)
    }
  })

  it('should have unique channel names', () => {
    const values = Object.values(IPC_CHANNELS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('should contain all required system channels', () => {
    expect(IPC_CHANNELS.SYSTEM_GET_STATS).toBeDefined()
    expect(IPC_CHANNELS.SYSTEM_SUBSCRIBE).toBeDefined()
    expect(IPC_CHANNELS.SYSTEM_UNSUBSCRIBE).toBeDefined()
  })

  it('should contain all required disk channels', () => {
    expect(IPC_CHANNELS.DISK_SCAN_FOLDER).toBeDefined()
    expect(IPC_CHANNELS.DISK_GET_LARGE_FILES).toBeDefined()
    expect(IPC_CHANNELS.DISK_GET_EXTENSIONS).toBeDefined()
    expect(IPC_CHANNELS.DISK_QUICK_SCAN).toBeDefined()
    expect(IPC_CHANNELS.DISK_USER_SPACE).toBeDefined()
    expect(IPC_CHANNELS.DISK_RECENT_GROWTH).toBeDefined()
    expect(IPC_CHANNELS.DISK_FIND_DUPLICATES).toBeDefined()
  })
})
