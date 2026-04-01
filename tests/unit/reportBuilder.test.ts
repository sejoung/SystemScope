import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', getPath: () => '/tmp/test' },
  dialog: { showSaveDialog: vi.fn() }
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

const { maskSensitivePaths } = await import('../../src/main/services/reportBuilder')

describe('reportBuilder', () => {
  describe('maskSensitivePaths', () => {
    it('replaces home directory with ~', () => {
      const input = '/Users/testuser/Documents/project'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('~/Documents/project')
    })

    it('replaces username with <user>', () => {
      const input = 'Owner: testuser running process'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('Owner: <user> running process')
    })

    it('handles multiple occurrences', () => {
      const input = '/Users/testuser/a and /Users/testuser/b'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('~/a and ~/b')
    })

    it('returns original string when no match', () => {
      const input = '/opt/data/file.txt'
      const result = maskSensitivePaths(input, '/Users/testuser', 'testuser')
      expect(result).toBe('/opt/data/file.txt')
    })
  })
})
