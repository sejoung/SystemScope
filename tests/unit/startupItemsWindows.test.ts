import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdirMock = vi.hoisted(() => vi.fn())
const renameMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const runMock = vi.hoisted(() => vi.fn())

vi.mock('node:fs/promises', () => ({
  readdir: readdirMock,
  rename: renameMock,
  mkdir: mkdirMock
}))

vi.mock('../../src/main/services/core/externalCommand', () => ({
  runExternalCommand: runMock,
  isExternalCommandError: () => false
}))

vi.mock('../../src/main/services/core/logging', () => ({ logDebug: vi.fn() }))

describe('Windows startup items', () => {
  beforeEach(() => {
    vi.resetModules()
    readdirMock.mockReset()
    renameMock.mockReset().mockResolvedValue(undefined)
    mkdirMock.mockReset().mockResolvedValue(undefined)
    runMock.mockReset()
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming'
  })

  it('lists disabled registry and Startup folder entries so they can be enabled again', async () => {
    runMock.mockImplementation(async (_command: string, args: string[]) => {
      const registryPath = args[1]
      if (registryPath.startsWith('HKCU') && registryPath.endsWith('RunDisabled')) {
        return { stdout: `${registryPath}\n    Tool    REG_SZ    C:\\Tools\\tool.exe\n`, stderr: '' }
      }
      throw new Error('missing key')
    })
    readdirMock.mockImplementation(async (dir: string) => {
      if (dir.endsWith('_disabled')) return ['Helper.lnk']
      return []
    })

    const { getWindowsStartupItems } = await import('../../src/main/services/startup/startupItems.windows')
    const items = await getWindowsStartupItems()

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Tool', enabled: false, type: 'registry_run' }),
      expect.objectContaining({ name: 'Helper', enabled: false, type: 'startup_folder' })
    ]))
  })

  it('moves disabled entries back to their active locations', async () => {
    const { toggleWindowsItem } = await import('../../src/main/services/startup/startupItems.windows')
    await toggleWindowsItem({
      id: 'registry',
      name: 'Tool',
      path: 'C:\\Tools\\tool.exe',
      type: 'registry_run',
      scope: 'user',
      enabled: false,
      label: 'Tool',
      description: 'Disabled registry startup item'
    }, true)

    expect(runMock).toHaveBeenNthCalledWith(1, 'reg', expect.arrayContaining(['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run']), expect.anything())
    expect(runMock).toHaveBeenNthCalledWith(2, 'reg', expect.arrayContaining(['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\RunDisabled']), expect.anything())

    await toggleWindowsItem({
      id: 'folder',
      name: 'Helper',
      path: 'C:\\Startup\\_disabled\\Helper.lnk',
      type: 'startup_folder',
      scope: 'user',
      enabled: false,
      label: 'Helper.lnk',
      description: 'Disabled Startup folder item'
    }, true)

    expect(renameMock).toHaveBeenCalledWith(
      'C:\\Startup\\_disabled\\Helper.lnk',
      'C:\\Startup\\Helper.lnk'
    )
  })
})
