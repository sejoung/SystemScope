import { beforeEach, describe, expect, it, vi } from 'vitest'

const originalAppData = process.env.APPDATA
const originalLocalAppData = process.env.LOCALAPPDATA
const originalProgramData = process.env.ProgramData

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'exe') return 'C:\\Program Files\\SystemScope\\SystemScope.exe'
      return ''
    }
  },
  shell: {}
}))

vi.mock('../../src/main/services/logging', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn()
}))

describe('installedApps helpers', () => {
  beforeEach(() => {
    process.env.APPDATA = originalAppData
    process.env.LOCALAPPDATA = originalLocalAppData
    process.env.ProgramData = originalProgramData
  })

  it('should parse Windows uninstall registry output into installed app records', async () => {
    const { parseWindowsRegistryOutput } = await import('../../src/main/services/installedApps')

    const parsed = parseWindowsRegistryOutput([
      'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ExampleApp',
      '    DisplayName    REG_SZ    Example App',
      '    DisplayVersion    REG_SZ    1.2.3',
      '    Publisher    REG_SZ    Example Inc.',
      '    InstallLocation    REG_SZ    C:\\Program Files\\Example App',
      '    UninstallString    REG_SZ    "C:\\Program Files\\Example App\\uninstall.exe"',
      '',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SystemScope',
      '    DisplayName    REG_SZ    SystemScope',
      '    InstallLocation    REG_SZ    C:\\Program Files\\SystemScope',
      '    UninstallString    REG_SZ    "C:\\Program Files\\SystemScope\\uninstall.exe"'
    ].join('\n'))

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({
      name: 'Example App',
      version: '1.2.3',
      publisher: 'Example Inc.',
      installLocation: 'C:\\Program Files\\Example App',
      uninstallKind: 'uninstall_command',
      protected: false
    })
    expect(parsed[1]).toMatchObject({
      name: 'SystemScope',
      protected: true,
      protectedReason: 'You cannot remove the currently running SystemScope app.'
    })
  })

  it('should build macOS related data candidates from app name and bundle id', async () => {
    const { getMacRelatedDataCandidates } = await import('../../src/main/services/installedApps')

    const candidates = getMacRelatedDataCandidates(
      { name: 'ToF', bundleId: 'com.example.tof' },
      '/Users/test'
    )

    expect(candidates.map((item) => item.path)).toContain('/Users/test/Library/Application Support/ToF')
    expect(candidates.map((item) => item.path)).toContain('/Users/test/Library/Application Support/com.example.tof')
    expect(candidates.map((item) => item.path)).toContain('/Users/test/Library/Preferences/com.example.tof.plist')
    expect(candidates.map((item) => item.path)).toContain('/Users/test/Library/Containers/com.example.tof')
  })

  it('should build Windows related data candidates from app name and install location', async () => {
    process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming'
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local'
    process.env.ProgramData = 'C:\\ProgramData'

    const { getWindowsRelatedDataCandidates } = await import('../../src/main/services/installedApps')

    const candidates = getWindowsRelatedDataCandidates({
      name: 'Example App',
      installLocation: 'C:\\Program Files\\Example App'
    })

    expect(candidates.map((item) => item.path)).toContain('C:\\Users\\Test\\AppData\\Roaming\\Example App')
    expect(candidates.map((item) => item.path)).toContain('C:\\Users\\Test\\AppData\\Local\\Programs\\Example App')
    expect(candidates.map((item) => item.path)).toContain('C:\\ProgramData\\Example App')
  })

  it('should infer macOS leftover app names from plist and saved state names', async () => {
    const { inferMacLeftoverAppName } = await import('../../src/main/services/installedApps')

    expect(inferMacLeftoverAppName('com.example.tof.plist')).toBe('com.example.tof')
    expect(inferMacLeftoverAppName('com.example.tof.savedState')).toBe('com.example.tof')
    expect(inferMacLeftoverAppName('ToF')).toBe('ToF')
  })
})
