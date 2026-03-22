import { describe, expect, it, vi } from 'vitest'

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
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn()
}))

describe('installedApps helpers', () => {
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
      protectedReason: '현재 실행 중인 SystemScope는 제거할 수 없습니다.'
    })
  })
})
