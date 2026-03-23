import { describe, expect, it } from 'vitest'
import { didShellOpenPathFail, isPathInsideAnyParent, isPathInsideParent } from '../../src/main/ipc/settingsPathUtils'

describe('settings IPC helpers', () => {
  it('should allow only the parent path itself or true descendants', () => {
    expect(isPathInsideParent('/tmp/app-data', '/tmp/app-data')).toBe(true)
    expect(isPathInsideParent('/tmp/app-data/logs/file.txt', '/tmp/app-data')).toBe(true)
    expect(isPathInsideParent('/tmp/app-data-sibling/file.txt', '/tmp/app-data')).toBe(false)
    expect(isPathInsideParent('/tmp/other/file.txt', '/tmp/app-data')).toBe(false)
  })

  it('should treat non-empty shell.openPath results as failures', () => {
    expect(didShellOpenPathFail('')).toBe(false)
    expect(didShellOpenPathFail('Failed to open item')).toBe(true)
  })

  it('should allow descendants of any approved parent path', () => {
    expect(isPathInsideAnyParent('/Users/me/AppData/Roaming/MyApp/file.txt', ['/tmp/app-data', '/Users/me/AppData'])).toBe(true)
    expect(isPathInsideAnyParent('/tmp/other/file.txt', ['/tmp/app-data', '/Users/me/AppData'])).toBe(false)
  })
})
