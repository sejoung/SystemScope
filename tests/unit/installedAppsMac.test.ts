import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdirMock = vi.hoisted(() => vi.fn())

vi.mock('node:os', () => ({
  homedir: () => '/Users/test',
}))

vi.mock('node:fs/promises', () => ({
  readdir: readdirMock,
  access: vi.fn(),
  stat: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/Applications/SystemScope.app/Contents/MacOS/SystemScope' },
}))

// `defaults read` is unavailable in tests → metadata falls back to the bundle name.
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: Error) => void
    cb(new Error('not available in tests'))
  },
}))

vi.mock('../../src/main/services/core/logging', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
}))

vi.mock('../../src/main/i18n', () => ({
  tk: (key: string) => key,
}))

interface MockEntry {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}
const dir = (name: string): MockEntry => ({ name, isDirectory: () => true, isFile: () => false })

const TREE: Record<string, MockEntry[]> = {
  '/Applications': [dir('Slack.app'), dir('SystemScope.app'), dir('CLIP STUDIO 1.5'), dir('nProtect'), dir('Utilities'), dir('EmptyFolder')],
  '/Applications/CLIP STUDIO 1.5': [dir('CLIP STUDIO PAINT.app'), dir('CLIP STUDIO.app')],
  '/Applications/nProtect': [dir('nProtect Online Security V1')],
  '/Applications/nProtect/nProtect Online Security V1': [dir('NOS')],
  '/Applications/nProtect/nProtect Online Security V1/NOS': [dir('nosudt.app')],
  '/Applications/Utilities': [dir('Some Tool.app')],
  '/Applications/EmptyFolder': [dir('docs')],
  '/Applications/EmptyFolder/docs': [],
  '/Users/test/Applications': [dir('Chrome Apps.localized')],
  '/Users/test/Applications/Chrome Apps.localized': [dir('Gmail.app'), dir('YouTube.app')],
  '/Users/Shared/Epic Games': [dir('UE_5.4'), dir('Fortnite')],
}

describe('listMacInstalledApps', () => {
  beforeEach(() => {
    vi.resetModules()
    readdirMock.mockReset()
    readdirMock.mockImplementation(async (p: string) => {
      const entries = TREE[p]
      if (!entries) throw new Error('ENOENT')
      return entries
    })
  })

  it('lists vendor folders as one trashable unit, not their inner apps', async () => {
    const { listMacInstalledApps } = await import('../../src/main/services/apps/installedApps.mac')
    const apps = await listMacInstalledApps()
    const names = apps.map((a) => a.name)

    expect(names).toContain('Slack')
    // The folder is the uninstall unit; inner apps would be noise (deleted along with it).
    expect(apps.find((a) => a.name === 'CLIP STUDIO 1.5')).toMatchObject({
      launchPath: '/Applications/CLIP STUDIO 1.5',
      installLocation: '/Applications',
    })
    expect(names).not.toContain('CLIP STUDIO PAINT')
    expect(names).not.toContain('CLIP STUDIO')
    expect(names).toContain('nProtect') // deep nesting still resolves to the top folder
    expect(names).not.toContain('nosudt')
    // Folders without any .app inside are not apps at all.
    expect(names).not.toContain('EmptyFolder')
  })

  it('lists apps inside collection folders (Utilities, Chrome Apps.localized) individually', async () => {
    const { listMacInstalledApps } = await import('../../src/main/services/apps/installedApps.mac')
    const apps = await listMacInstalledApps()
    const names = apps.map((a) => a.name)

    expect(names).not.toContain('Utilities')
    expect(names).toContain('Some Tool')
    expect(names).not.toContain('Chrome Apps.localized')
    expect(names).toContain('Gmail')
    expect(names).toContain('YouTube')
    expect(apps.find((a) => a.name === 'Gmail')).toMatchObject({
      launchPath: '/Users/test/Applications/Chrome Apps.localized/Gmail.app',
    })
  })

  it('lists Epic Games folders (Unreal Engine and games) as trashable apps', async () => {
    const { listMacInstalledApps } = await import('../../src/main/services/apps/installedApps.mac')
    const apps = await listMacInstalledApps()

    expect(apps.find((a) => a.name === 'Unreal Engine 5.4')).toMatchObject({
      version: '5.4',
      publisher: 'Epic Games',
      launchPath: '/Users/Shared/Epic Games/UE_5.4', // whole engine folder is the uninstall unit
      uninstallKind: 'trash_app',
      protected: false,
    })
    expect(apps.find((a) => a.name === 'Fortnite')).toMatchObject({
      publisher: 'Epic Games',
      launchPath: '/Users/Shared/Epic Games/Fortnite',
    })
  })

  it('still protects the running app bundle', async () => {
    const { listMacInstalledApps } = await import('../../src/main/services/apps/installedApps.mac')
    const apps = await listMacInstalledApps()

    expect(apps.find((a) => a.name === 'SystemScope')?.protected).toBe(true)
    expect(apps.find((a) => a.name === 'Slack')?.protected).toBe(false)
  })
})
